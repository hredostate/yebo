
// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shared validation constants and helpers
// Note: These are duplicated from src/utils/validation.ts because Supabase Edge Functions
// use Deno with URL-based imports and cannot directly import from the local TypeScript codebase.
// Keep these in sync with the frontend validation module.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmail(student: any): string {
  return (student.email || student.Email || student.EMAIL || '').trim();
}

function validateEmail(email: string): boolean {
  if (!email) return true;
  return EMAIL_REGEX.test(email);
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Initialize Supabase admin client early (before helper functions that use it)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  /**
   * Helper function to send student credentials via SMS/WhatsApp
   * Uses the existing messaging system with channel preferences
   */
  async function sendCredentialsToParent(params: {
    studentName: string;
    username: string;
    password: string;
    schoolId: number;
    parentPhone1?: string;
    parentPhone2?: string;
    isPasswordReset?: boolean;
  }): Promise<{
    messagingResults: Array<{
      phone: string;
      success: boolean;
      channel?: string;
      error?: string;
    }>;
  }> {
    const { studentName, username, password, schoolId, parentPhone1, parentPhone2, isPasswordReset } = params;
    const messagingResults: Array<{ phone: string; success: boolean; channel?: string; error?: string }> = [];

    // Get school name for the message
    let schoolName = 'UPSS';
    try {
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single();
      if (school?.name) {
        schoolName = school.name;
      }
    } catch (e) {
      console.error('Failed to fetch school name:', e);
    }

    // Template name based on whether it's a reset or new credential
    const templateName = isPasswordReset ? 'password_reset' : 'student_credentials';

    // Collect phone numbers
    const phoneNumbers: string[] = [];
    if (parentPhone1) phoneNumbers.push(parentPhone1);
    if (parentPhone2) phoneNumbers.push(parentPhone2);

    if (phoneNumbers.length === 0) {
      console.log(`No parent phone numbers for student: ${studentName}`);
      return { messagingResults };
    }

    // Send to each phone number
    for (const phone of phoneNumbers) {
      try {
        // Prepare variables for the template
        const variables = isPasswordReset 
          ? { student_name: studentName, password, school_name: schoolName }
          : { student_name: studentName, username, password, school_name: schoolName };

        // Try to send via the messaging system
        // First, invoke kudisms-send edge function directly with template
        const { data: result, error: sendError } = await supabaseAdmin.functions.invoke(
          'kudisms-send',
          {
            body: {
              phone_number: phone,
              school_id: schoolId,
              template_name: templateName,
              variables: variables
            }
          }
        );

        if (sendError || !result?.success) {
          messagingResults.push({
            phone,
            success: false,
            error: sendError?.message || result?.error || 'Failed to send message'
          });
        } else {
          messagingResults.push({
            phone,
            success: true,
            channel: result.channel || 'sms'
          });
        }

        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`Error sending credentials to ${phone}:`, error);
        messagingResults.push({
          phone,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    return { messagingResults };
  }

  /**
   * Helper function to generate a username in firstname.lastname format
   * @param fullName - The student's full name
   * @param existingUsernames - Optional set of existing usernames to check for uniqueness
   * @returns Username in firstname.lastname format (may have numeric suffix if needed)
   */
  function generateUsernameFromName(fullName: string, existingUsernames?: Set<string>): string {
    const MAX_USERNAME_SUFFIX_ATTEMPTS = 100;
    
    // Remove extra whitespace and split name into parts
    const nameParts = fullName.trim().toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    
    if (nameParts.length === 0) {
      // Fallback if name is empty or invalid
      return `student${Date.now().toString().slice(-6)}`;
    }
    
    let firstName = nameParts[0];
    let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    
    // If only one name part, use it as both first and last
    if (!lastName) {
      lastName = firstName;
    }
    
    // Generate base username
    let baseUsername = `${firstName}.${lastName}`;
    
    // If no existing usernames provided, return base username
    if (!existingUsernames) {
      return baseUsername;
    }
    
    // Check if username already exists
    if (!existingUsernames.has(baseUsername)) {
      return baseUsername;
    }
    
    // Add numeric suffix if username exists
    let counter = 1;
    let username = `${baseUsername}${counter}`;
    while (existingUsernames.has(username) && counter < MAX_USERNAME_SUFFIX_ATTEMPTS) {
      counter++;
      username = `${baseUsername}${counter}`;
    }
    
    return username;
  }

  /**
   * Helper function to generate a unique username from a name
   * @deprecated Use generateUsernameFromName() for students. This function is for STAFF ACCOUNTS ONLY.
   * Generates username in format: cleanname + timestamp (e.g., "johndoe1234")
   * DO NOT use this for student accounts as it creates usernames that don't match the 
   * expected firstname.lastname format required for student login.
   */
  function generateUsername(name: string, suffix?: string): string {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueSuffix = suffix || `${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;
    return `${cleanName}${uniqueSuffix}`;
  }

  /**
   * Helper function to generate a strong password
   */
  function generateStaffPassword(): string {
    return `Staff${Math.floor(1000 + Math.random() * 9000)}!`;
  }

  /**
   * Helper function to send staff credentials via SMS
   * Uses the existing messaging system with staff-specific templates
   */
  async function sendCredentialsToStaff(params: {
    staffName: string;
    username: string;
    password: string;
    schoolId: number;
    staffPhone?: string;
    isPasswordReset?: boolean;
  }): Promise<{
    messagingResults: Array<{
      phone: string;
      success: boolean;
      channel?: string;
      error?: string;
    }>;
  }> {
    const { staffName, username, password, schoolId, staffPhone, isPasswordReset } = params;
    const messagingResults: Array<{ phone: string; success: boolean; channel?: string; error?: string }> = [];

    // Get school name for the message
    let schoolName = 'UPSS';
    try {
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single();
      if (school?.name) {
        schoolName = school.name;
      }
    } catch (e) {
      console.error('Failed to fetch school name:', e);
    }

    // Template name based on whether it's a reset or new credential
    const templateName = isPasswordReset ? 'staff_password_reset' : 'staff_credentials';

    if (!staffPhone) {
      console.log(`No phone number for staff: ${staffName}`);
      return { messagingResults };
    }

    try {
      // Prepare variables for the template
      const variables = isPasswordReset 
        ? { staff_name: staffName, password, school_name: schoolName }
        : { staff_name: staffName, username, password, school_name: schoolName };

      // Try to send via the messaging system
      const { data: result, error: sendError } = await supabaseAdmin.functions.invoke(
        'kudisms-send',
        {
          body: {
            phone_number: staffPhone,
            school_id: schoolId,
            template_name: templateName,
            variables: variables
          }
        }
      );

      if (sendError || !result?.success) {
        messagingResults.push({
          phone: staffPhone,
          success: false,
          error: sendError?.message || result?.error || 'Failed to send message'
        });
      } else {
        messagingResults.push({
          phone: staffPhone,
          success: true,
          channel: result.channel || 'sms'
        });
      }
    } catch (error: any) {
      console.error(`Error sending credentials to ${staffPhone}:`, error);
      messagingResults.push({
        phone: staffPhone,
        success: false,
        error: error.message || 'Unknown error'
      });
    }

    return { messagingResults };
  }

  try {
    // Safely parse body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error('Invalid JSON body.');
    }

    const { action, students, studentId, studentIds } = body;
    
    console.log(`Processing action: ${action}`);

    if (action === 'bulk_create') {
        if (!students || !Array.isArray(students)) throw new Error("Invalid 'students' array.");

        console.log(`Processing bulk_create for ${students.length} students`);
        const results = [];
        
        for (const student of students) {
            try {
                const studentName = student.name || 'Unknown Student';
                console.log(`Processing student: ${studentName}`);
                
                // Validate required fields
                if (!student.school_id) {
                    results.push({ name: studentName, status: 'Failed', error: 'Missing school_id' });
                    continue;
                }

                // Server-side validation for data quality
                // Validate email format if provided
                const providedEmail = extractEmail(student);
                if (providedEmail && !validateEmail(providedEmail)) {
                    results.push({ 
                        name: studentName, 
                        status: 'Failed', 
                        error: `Invalid email format: "${providedEmail}"` 
                    });
                    continue;
                }

                // Validate phone numbers if provided
                const phoneFields = ['parent_phone_number_1', 'parent_phone_number_2'];
                let phoneValidationError = null;
                for (const field of phoneFields) {
                    if (student[field]) {
                        const phone = student[field].toString().trim();
                        // Check for scientific notation
                        if (/[eE][+-]?\d+/.test(phone)) {
                            phoneValidationError = `${field} appears to be in scientific notation: "${phone}"`;
                            break;
                        }
                        // Check for proper format
                        const cleaned = phone.replace(/[\s\-()]/g, '');
                        if (!/^\d+$/.test(cleaned)) {
                            phoneValidationError = `${field} contains non-numeric characters: "${phone}"`;
                            break;
                        }
                        if (cleaned.length < 10 || cleaned.length > 15) {
                            phoneValidationError = `${field} has invalid length (${cleaned.length} digits): "${phone}"`;
                            break;
                        }
                    }
                }
                
                if (phoneValidationError) {
                    results.push({ name: studentName, status: 'Failed', error: phoneValidationError });
                    continue;
                }

                // Check if student already exists by admission_number, name, or email
                let existingStudent = null;
                
                if (student.admission_number) {
                    const { data } = await supabaseAdmin
                        .from('students')
                        .select('*')
                        .eq('school_id', student.school_id)
                        .eq('admission_number', student.admission_number)
                        .maybeSingle();
                    existingStudent = data;
                }
                
                if (!existingStudent && studentName) {
                    const { data } = await supabaseAdmin
                        .from('students')
                        .select('*')
                        .eq('school_id', student.school_id)
                        .ilike('name', studentName)
                        .maybeSingle();
                    existingStudent = data;
                }
                
                // Also check by email if provided (helps prevent duplicates on retry)
                if (!existingStudent && providedEmail) {
                    const { data } = await supabaseAdmin
                        .from('students')
                        .select('*')
                        .eq('school_id', student.school_id)
                        .ilike('email', providedEmail)
                        .maybeSingle();
                    existingStudent = data;
                }

                // If existing student already has an account, skip them
                if (existingStudent?.user_id) {
                    console.log(`Skipping ${studentName} - account already exists`);
                    results.push({ 
                        name: studentName, 
                        status: 'Skipped', 
                        error: 'Account already exists' 
                    });
                    continue;
                }

                // Generate username and password
                // Username format: firstname.lastname
                // For new students in bulk_create, we'll generate a temporary username first
                // then update it with a unique version after getting the student ID
                
                const tempUsername = generateUsernameFromName(studentName);
                const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
                
                // Use provided email or generate one using temp username
                const email = providedEmail || `${tempUsername}@upsshub.com`;

                console.log(`Student ${studentName}: temp_username = "${tempUsername}", email = "${email}"`);

                console.log(`Creating auth user with email: ${email}`);

                const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
                    email: email,
                    password: password,
                    email_confirm: true,
                    user_metadata: {
                        name: studentName,
                        username: tempUsername, // Store temp username in metadata, will update after getting student ID
                        user_type: 'student',
                        class_id: student.class_id,
                        arm_id: student.arm_id,
                        admission_number: student.admission_number,
                        initial_password: password,
                        school_id: student.school_id,
                        skip_student_creation: !!existingStudent // Skip if we'll update existing
                    }
                });

                if (userError) {
                    console.error(`Auth user creation failed for ${studentName}:`, userError);
                    // Provide more context in error message
                    const errorMsg = userError.message.includes('email') 
                        ? `Email error: ${userError.message}`
                        : userError.message;
                    results.push({ name: studentName, status: 'Failed', error: errorMsg });
                    continue;
                }

                console.log(`Successfully created auth user for ${studentName}, ID: ${newUser.user.id}`);

                // Link auth user to student record
                let finalStudentId: number | null = null;
                if (existingStudent) {
                    // Update existing student record with new user_id
                    const { error: updateError } = await supabaseAdmin
                        .from('students')
                        .update({ 
                            user_id: newUser.user.id,
                            class_id: student.class_id || existingStudent.class_id,
                            arm_id: student.arm_id || existingStudent.arm_id
                        })
                        .eq('id', existingStudent.id);
                    
                    if (updateError) {
                        console.error(`Failed to update student record for ${studentName}:`, updateError);
                    } else {
                        finalStudentId = existingStudent.id;
                    }

                    // Update student_profiles to link student_record_id
                    const { error: profileError } = await supabaseAdmin
                        .from('student_profiles')
                        .update({ student_record_id: existingStudent.id })
                        .eq('id', newUser.user.id);
                    
                    if (profileError) {
                        console.error(`Failed to update student profile for ${studentName}:`, profileError);
                    }
                } else {
                    // Create new student record and link it
                    const { data: newStudent, error: insertError } = await supabaseAdmin
                        .from('students')
                        .insert({
                            name: studentName,
                            admission_number: student.admission_number,
                            school_id: student.school_id,
                            class_id: student.class_id,
                            arm_id: student.arm_id,
                            email: email,
                            user_id: newUser.user.id,
                            status: 'Active',
                            date_of_birth: student.date_of_birth,
                            parent_phone_number_1: student.parent_phone_number_1
                        })
                        .select()
                        .single();
                    
                    if (insertError) {
                        console.error(`Failed to create student record for ${studentName}:`, insertError);
                    } else if (newStudent) {
                        finalStudentId = newStudent.id;
                        
                        // Update student_profiles to link student_record_id
                        const { error: profileLinkError } = await supabaseAdmin
                            .from('student_profiles')
                            .update({ student_record_id: newStudent.id })
                            .eq('id', newUser.user.id);
                        
                        if (profileLinkError) {
                            console.error(`Failed to link student profile for ${studentName}:`, profileLinkError);
                        }
                    }
                }

                // Now update username with a unique version if needed
                // Check if this username already exists in the school
                const { data: existingUsers } = await supabaseAdmin
                    .from('students')
                    .select('email')
                    .eq('school_id', student.school_id)
                    .like('email', `${tempUsername}%@upsshub.com`);
                
                const existingUsernames = new Set(
                    (existingUsers || []).map(u => u.email.replace('@upsshub.com', ''))
                );
                
                const finalUsername = generateUsernameFromName(studentName, existingUsernames);
                const finalEmail = providedEmail || `${finalUsername}@upsshub.com`;
                
                // Update auth user with final username and email if different
                if (finalUsername !== tempUsername && !providedEmail) {
                    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
                        newUser.user.id,
                        {
                            email: finalEmail,
                            email_confirm: true,
                            user_metadata: {
                                ...newUser.user.user_metadata,
                                username: finalUsername
                            }
                        }
                    );
                    
                    if (updateAuthError) {
                        console.error(`Failed to update auth user with final username for ${studentName}:`, updateAuthError);
                    } else {
                        // Also update student record email if it was generated
                        if (finalStudentId) {
                            await supabaseAdmin
                                .from('students')
                                .update({ email: finalEmail })
                                .eq('id', finalStudentId);
                        }
                    }
                }

                results.push({ name: studentName, username: finalUsername, email: finalEmail, password: password, status: 'Success' });
                
            } catch (innerError: any) {
                console.error(`Crash processing student ${student.name}:`, innerError);
                results.push({ name: student.name || 'Unknown', status: 'Failed', error: `System Error: ${innerError.message}` });
            }
        }

        console.log(`Bulk create completed. Results: ${results.length} processed`);
        return new Response(JSON.stringify({ success: true, credentials: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'create_single_for_existing') {
        if (!studentId) throw new Error("Missing 'studentId'.");

        const { data: studentRecord, error: fetchError } = await supabaseAdmin
            .from('students')
            .select('*')
            .eq('id', studentId)
            .single();

        if (fetchError || !studentRecord) {
            throw new Error('Student record not found in database.');
        }

        if (studentRecord.user_id) {
            throw new Error('This student already has a login account.');
        }

        // Generate username in firstname.lastname format
        // Check for existing usernames in the school
        const { data: existingUsers } = await supabaseAdmin
            .from('students')
            .select('email')
            .eq('school_id', studentRecord.school_id)
            .ilike('email', '%.%@upsshub.com');
        
        const existingUsernames = new Set(
            (existingUsers || []).map(u => u.email.replace('@upsshub.com', ''))
        );
        
        const username = generateUsernameFromName(studentRecord.name, existingUsernames);
        const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
        const email = studentRecord.email || `${username}@upsshub.com`;

        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                name: studentRecord.name,
                username: username, // Store username
                user_type: 'student',
                class_id: studentRecord.class_id,
                arm_id: studentRecord.arm_id,
                admission_number: studentRecord.admission_number,
                initial_password: password,
                school_id: studentRecord.school_id,
                skip_student_creation: true
            }
        });

        if (userError) throw userError;

        const { error: updateError } = await supabaseAdmin
            .from('students')
            .update({ user_id: user.user.id })
            .eq('id', studentId);

        if (updateError) throw updateError;
        
        await supabaseAdmin
            .from('student_profiles')
            .update({ student_record_id: studentId })
            .eq('id', user.user.id);

        // Send credentials to parent phone numbers
        const { messagingResults } = await sendCredentialsToParent({
            studentName: studentRecord.name,
            username,
            password,
            schoolId: studentRecord.school_id,
            parentPhone1: studentRecord.parent_phone_number_1,
            parentPhone2: studentRecord.parent_phone_number_2,
            isPasswordReset: false
        });

        return new Response(JSON.stringify({ 
            success: true, 
            credential: { username, email, password },
            messagingResults
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'bulk_create_for_existing') {
        if (!studentIds || !Array.isArray(studentIds)) {
            throw new Error("studentIds array is required");
        }

        // Fetch all existing usernames in the school first for efficiency
        const firstStudent = await supabaseAdmin
            .from('students')
            .select('school_id')
            .eq('id', studentIds[0])
            .single();
        
        let existingUsernames = new Set<string>();
        if (firstStudent.data?.school_id) {
            const { data: existingUsers } = await supabaseAdmin
                .from('students')
                .select('email')
                .eq('school_id', firstStudent.data.school_id)
                .ilike('email', '%.%@upsshub.com');
            
            existingUsernames = new Set(
                (existingUsers || []).map(u => u.email.replace('@upsshub.com', ''))
            );
        }

        const results = [];
        for (const id of studentIds) {
             const { data: student, error: fetchError } = await supabaseAdmin
                .from('students')
                .select('*')
                .eq('id', id)
                .single();
             
             if (fetchError || !student) {
                 results.push({ id, name: `ID: ${id}`, status: 'Failed', error: 'Student not found' });
                 continue;
             }

             if (student.user_id) {
                 results.push({ id, name: student.name, status: 'Skipped', error: 'Account already exists' });
                 continue;
             }

             // Generate username in firstname.lastname format
             const username = generateUsernameFromName(student.name, existingUsernames);
             existingUsernames.add(username); // Add to set to prevent duplicates in this batch
             
             const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
             const email = student.email || `${username}@upsshub.com`;

             const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: {
                    name: student.name,
                    username: username, // Store username
                    user_type: 'student',
                    class_id: student.class_id,
                    arm_id: student.arm_id,
                    admission_number: student.admission_number,
                    initial_password: password,
                    school_id: student.school_id,
                    skip_student_creation: true
                }
            });

            if (userError) {
                results.push({ name: student.name, status: 'Failed', error: userError.message });
            } else {
                await supabaseAdmin.from('students').update({ user_id: user.user.id }).eq('id', id);
                
                await supabaseAdmin
                    .from('student_profiles')
                    .update({ student_record_id: id })
                    .eq('id', user.user.id);

                // Send credentials to parent phone numbers
                const { messagingResults } = await sendCredentialsToParent({
                    studentName: student.name,
                    username,
                    password,
                    schoolId: student.school_id,
                    parentPhone1: student.parent_phone_number_1,
                    parentPhone2: student.parent_phone_number_2,
                    isPasswordReset: false
                });

                results.push({ 
                    name: student.name, 
                    username, 
                    email, 
                    password, 
                    status: 'Success',
                    messagingResults 
                });
            }
        }

        return new Response(JSON.stringify({ success: true, credentials: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'reset_password') {
        console.log('reset_password action called with studentId:', studentId);
        
        if (!studentId) {
            console.error("Missing studentId");
            throw new Error("Missing 'studentId' for password reset.");
        }

        // In this system, the studentId passed from the app IS the auth user UUID
        // (student_profiles.id references auth.users.id directly)
        // So we can directly use studentId as the auth user ID
        
        const newPassword = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
        console.log('Attempting to reset password for auth user ID:', studentId);
        
        // Try to get the auth user directly
        let authUser;
        let authError;
        
        try {
            const result = await supabaseAdmin.auth.admin.getUserById(studentId);
            authUser = result.data;
            authError = result.error;
        } catch (e: any) {
            console.error('Exception calling getUserById:', e.message);
            throw new Error(`Failed to access auth user: ${e.message}`);
        }
        
        if (authError) {
            console.error("Auth user fetch error:", authError);
            throw new Error(`Could not find the authentication user: ${authError.message}`);
        }
        
        if (!authUser || !authUser.user) {
            console.error("Auth user is null or missing user object");
            throw new Error("Could not find the authentication user. The account might have been deleted.");
        }

        console.log('Auth user found:', authUser.user.email, '- updating password...');
        
        // Safely merge metadata
        const currentMetadata = authUser.user.user_metadata || {};

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            studentId,
            {
                password: newPassword,
                user_metadata: {
                    ...currentMetadata,
                    initial_password: newPassword
                }
            }
        );

        if (updateError) {
            console.error("Update User Error:", updateError);
            throw new Error(`Failed to update user password: ${updateError.message}`);
        }

        console.log('Password reset successful');

        // Get student record to fetch parent phone numbers and student name
        const { data: studentProfile } = await supabaseAdmin
            .from('student_profiles')
            .select('student_record_id')
            .eq('id', studentId)
            .single();

        let messagingResults: any[] = [];
        if (studentProfile?.student_record_id) {
            const { data: studentRecord } = await supabaseAdmin
                .from('students')
                .select('name, school_id, parent_phone_number_1, parent_phone_number_2')
                .eq('id', studentProfile.student_record_id)
                .single();

            if (studentRecord) {
                const result = await sendCredentialsToParent({
                    studentName: studentRecord.name,
                    username: '', // Not needed for password reset
                    password: newPassword,
                    schoolId: studentRecord.school_id,
                    parentPhone1: studentRecord.parent_phone_number_1,
                    parentPhone2: studentRecord.parent_phone_number_2,
                    isPasswordReset: true
                });
                messagingResults = result.messagingResults;
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            password: newPassword,
            messagingResults 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Resend credentials to parent phone numbers
    if (action === 'resend_credentials') {
        console.log('resend_credentials action called with studentId:', studentId);
        
        if (!studentId) {
            throw new Error("Missing 'studentId' for resending credentials.");
        }

        // Get student record to fetch parent phone numbers, student name, and username
        const { data: studentRecord, error: fetchError } = await supabaseAdmin
            .from('students')
            .select('name, school_id, parent_phone_number_1, parent_phone_number_2, user_id')
            .eq('id', studentId)
            .single();

        if (fetchError || !studentRecord) {
            throw new Error('Student record not found.');
        }

        if (!studentRecord.user_id) {
            throw new Error('Student does not have a login account.');
        }

        // Get username and password from auth user metadata
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(studentRecord.user_id);
        
        if (authError || !authUser?.user) {
            throw new Error('Could not find authentication user.');
        }

        const username = authUser.user.user_metadata?.username || authUser.user.email?.split('@')[0] || '';
        const password = authUser.user.user_metadata?.initial_password;

        if (!password) {
            throw new Error('Password not found in user metadata. Please reset the password first.');
        }

        // Send credentials to parent phone numbers
        const { messagingResults } = await sendCredentialsToParent({
            studentName: studentRecord.name,
            username,
            password,
            schoolId: studentRecord.school_id,
            parentPhone1: studentRecord.parent_phone_number_1,
            parentPhone2: studentRecord.parent_phone_number_2,
            isPasswordReset: false
        });

        return new Response(JSON.stringify({ 
            success: true,
            messagingResults 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Delete a single student account
    if (action === 'delete_account') {
        console.log('delete_account action called with studentId:', studentId);
        
        if (!studentId) {
            console.error("Missing studentId");
            throw new Error("Missing 'studentId' for account deletion.");
        }

        // The studentId is the auth user UUID (student_profiles.id = auth.users.id)
        console.log('Attempting to delete auth user ID:', studentId);
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(studentId);
        
        if (deleteError) {
            console.error("Delete user error:", deleteError);
            throw new Error(`Failed to delete user account: ${deleteError.message}`);
        }

        console.log('Account deleted successfully');
        return new Response(JSON.stringify({ success: true, message: 'Account deleted successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Bulk delete student accounts
    if (action === 'bulk_delete') {
        console.log('bulk_delete action called');
        
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            throw new Error("Missing or invalid 'studentIds' array for bulk deletion.");
        }

        console.log(`Processing bulk delete for ${studentIds.length} accounts`);
        const results = [];

        for (const id of studentIds) {
            try {
                console.log(`Deleting account: ${id}`);
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
                
                if (deleteError) {
                    console.error(`Failed to delete ${id}:`, deleteError);
                    results.push({ id, status: 'Failed', error: deleteError.message });
                } else {
                    console.log(`Successfully deleted ${id}`);
                    results.push({ id, status: 'Deleted' });
                }
            } catch (e: any) {
                console.error(`Exception deleting ${id}:`, e);
                results.push({ id, status: 'Failed', error: e.message });
            }
        }

        const successCount = results.filter(r => r.status === 'Deleted').length;
        console.log(`Bulk delete completed. ${successCount}/${studentIds.length} deleted successfully`);
        
        return new Response(JSON.stringify({ success: true, results, deleted: successCount, total: studentIds.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Delete a staff account from auth.users (user_profiles will cascade delete)
    if (action === 'delete_staff_account') {
        console.log('delete_staff_account action called');
        
        const { userId } = body;
        
        if (!userId) {
            console.error("Missing userId");
            throw new Error("Missing 'userId' for staff account deletion.");
        }

        // The userId is the auth user UUID (user_profiles.id = auth.users.id)
        console.log('Attempting to delete staff auth user ID:', userId);
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
            console.error("Delete staff user error:", deleteError);
            throw new Error(`Failed to delete staff account: ${deleteError.message}`);
        }

        console.log('Staff account deleted successfully');
        return new Response(JSON.stringify({ success: true, message: 'Staff account deleted successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Update staff user email in auth.users
    if (action === 'update_staff_email') {
        console.log('update_staff_email action called');
        
        const { userId, email } = body;
        
        if (!userId || !email) {
            console.error("Missing userId or email");
            throw new Error("Missing 'userId' or 'email' for staff email update.");
        }

        // Validate email format
        if (!email || !validateEmail(email)) {
            throw new Error(`Invalid email format: "${email}"`);
        }

        console.log(`Updating staff user ${userId} email to: ${email}`);
        
        // Get current auth user to preserve metadata
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserError || !authUser || !authUser.user) {
            console.error("Failed to get auth user:", getUserError);
            throw new Error(`Failed to get user: ${getUserError?.message || 'User not found'}`);
        }

        // Update email in auth.users
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                email: email,
                email_confirm: true
            }
        );

        if (updateError) {
            console.error("Update staff email error:", updateError);
            throw new Error(`Failed to update staff email: ${updateError.message}`);
        }

        console.log('Staff email updated successfully in auth.users');
        return new Response(JSON.stringify({ success: true, message: 'Staff email updated successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Create a single staff account without email verification
    if (action === 'create_staff_account') {
        console.log('create_staff_account action called');
        
        const { name, role, phone_number, school_id, campus_id } = body;
        
        if (!name || !role || !school_id) {
            throw new Error("Missing required fields: name, role, or school_id");
        }

        // Generate username and password using helper functions
        const username = generateUsername(name);
        const password = generateStaffPassword();
        const email = `${username}@upsshub.com`; // Internal email, not used for delivery

        console.log(`Creating staff account for ${name} with username: ${username}`);

        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Skip email verification
            user_metadata: {
                name: name,
                username: username,
                user_type: 'staff',
                initial_password: password,
                school_id: school_id,
                role: role
            }
        });

        if (userError) {
            console.error('Failed to create staff auth user:', userError);
            throw new Error(`Failed to create staff account: ${userError.message}`);
        }

        console.log('Staff auth user created:', user.user.id);

        // Create user_profiles entry (should be auto-created by trigger, but we'll update it)
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .update({
                phone_number: phone_number,
                campus_id: campus_id
            })
            .eq('id', user.user.id);

        if (profileError) {
            console.error('Failed to update user profile:', profileError);
        }

        // Send credentials via SMS to phone_number
        let messagingResults: any[] = [];
        if (phone_number) {
            const result = await sendCredentialsToStaff({
                staffName: name,
                username,
                password,
                schoolId: school_id,
                staffPhone: phone_number,
                isPasswordReset: false
            });
            messagingResults = result.messagingResults;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            credential: { username, password },
            messagingResults
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Bulk create staff accounts
    if (action === 'bulk_create_staff_accounts') {
        console.log('bulk_create_staff_accounts action called');
        
        const { staffData } = body;
        
        if (!staffData || !Array.isArray(staffData)) {
            throw new Error("Missing or invalid 'staffData' array");
        }

        console.log(`Processing bulk create for ${staffData.length} staff members`);
        const results = [];

        for (const staff of staffData) {
            try {
                const { name, role, phone_number, school_id, campus_id } = staff;
                
                if (!name || !role || !school_id) {
                    results.push({ 
                        name: name || 'Unknown', 
                        status: 'Failed', 
                        error: 'Missing required fields' 
                    });
                    continue;
                }

                // Generate username and password using helper functions
                const username = generateUsername(name);
                const password = generateStaffPassword();
                const email = `${username}@upsshub.com`;

                const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
                    email: email,
                    password: password,
                    email_confirm: true,
                    user_metadata: {
                        name: name,
                        username: username,
                        user_type: 'staff',
                        initial_password: password,
                        school_id: school_id,
                        role: role
                    }
                });

                if (userError) {
                    results.push({ 
                        name, 
                        status: 'Failed', 
                        error: userError.message 
                    });
                    continue;
                }

                // Update user profile with phone and campus
                await supabaseAdmin
                    .from('user_profiles')
                    .update({
                        phone_number: phone_number,
                        campus_id: campus_id
                    })
                    .eq('id', user.user.id);

                // Send credentials via SMS
                let messagingResults: any[] = [];
                if (phone_number) {
                    const result = await sendCredentialsToStaff({
                        staffName: name,
                        username,
                        password,
                        schoolId: school_id,
                        staffPhone: phone_number,
                        isPasswordReset: false
                    });
                    messagingResults = result.messagingResults;
                }

                results.push({ 
                    name, 
                    username, 
                    password, 
                    status: 'Success',
                    messagingResults 
                });

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
                console.error(`Error creating staff account for ${staff.name}:`, error);
                results.push({ 
                    name: staff.name || 'Unknown', 
                    status: 'Failed', 
                    error: error.message 
                });
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            credentials: results 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Reset staff password
    if (action === 'reset_staff_password') {
        console.log('reset_staff_password action called');
        
        const { userId } = body;
        
        if (!userId) {
            throw new Error("Missing 'userId' for password reset");
        }

        // Generate new password using helper function
        const newPassword = generateStaffPassword();
        console.log('Attempting to reset password for staff user ID:', userId);

        // Get current auth user to preserve metadata
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserError || !authUser?.user) {
            throw new Error(`Failed to get user: ${getUserError?.message || 'User not found'}`);
        }

        // Update password using admin API
        const currentMetadata = authUser.user.user_metadata || {};
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                password: newPassword,
                user_metadata: {
                    ...currentMetadata,
                    initial_password: newPassword
                }
            }
        );

        if (updateError) {
            throw new Error(`Failed to update password: ${updateError.message}`);
        }

        console.log('Password reset successful');

        // Get user's phone number from user_profiles
        const { data: userProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('phone_number, name, school_id')
            .eq('id', userId)
            .single();

        let messagingResults: any[] = [];
        if (userProfile?.phone_number) {
            const result = await sendCredentialsToStaff({
                staffName: userProfile.name || 'Staff Member',
                username: '', // Not needed for password reset
                password: newPassword,
                schoolId: userProfile.school_id,
                staffPhone: userProfile.phone_number,
                isPasswordReset: true
            });
            messagingResults = result.messagingResults;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            password: newPassword,
            messagingResults 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // ============================================================================
    // PARENT ACCOUNT MANAGEMENT ACTIONS
    // ============================================================================

    if (action === 'create_parent_account') {
        const { name, phone_number, phone_number_2, student_ids, relationship, school_id } = body;
        
        if (!name || !phone_number || !student_ids || student_ids.length === 0) {
            throw new Error('Name, phone number, and at least one student are required');
        }
        
        console.log(`Creating parent account for: ${name}`);
        
        // Generate credentials
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const username = `parent_${cleanName}${Date.now().toString().slice(-4)}`;
        const password = `Parent${Math.floor(1000 + Math.random() * 9000)}!`;
        const email = `${username}@upsshub.com`;
        
        // Create auth user
        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name,
                username,
                user_type: 'parent',
                initial_password: password,
                school_id,
                phone_number
            }
        });
        
        if (userError) throw userError;
        
        console.log(`Parent auth user created: ${user.user.id}`);
        
        // Update parent profile with additional fields
        if (phone_number_2) {
            await supabaseAdmin.from('parent_profiles').update({
                phone_number_2,
            }).eq('id', user.user.id);
        }
        
        // Link to students
        const linkResults = [];
        for (const studentId of student_ids) {
            const { error: linkError } = await supabaseAdmin.from('parent_student_links').insert({
                parent_id: user.user.id,
                student_id: studentId,
                relationship: relationship || 'Guardian',
                is_primary_contact: student_ids.indexOf(studentId) === 0
            });
            
            if (linkError) {
                console.error(`Failed to link to student ${studentId}:`, linkError);
                linkResults.push({ studentId, success: false, error: linkError.message });
            } else {
                linkResults.push({ studentId, success: true });
            }
        }
        
        // Send credentials via SMS
        const messagingResults: any[] = [];
        
        // Get school name
        let schoolName = 'UPSS';
        try {
            const { data: school } = await supabaseAdmin
                .from('schools')
                .select('name')
                .eq('id', school_id)
                .single();
            if (school?.name) {
                schoolName = school.name;
            }
        } catch (e) {
            console.error('Failed to fetch school name:', e);
        }
        
        // Send to primary phone
        try {
            const { data: result, error: sendError } = await supabaseAdmin.functions.invoke(
                'kudisms-send',
                {
                    body: {
                        phone_number: phone_number,
                        school_id: school_id,
                        template_name: 'parent_credentials',
                        variables: {
                            parent_name: name,
                            username,
                            password,
                            school_name: schoolName,
                            app_url: 'https://upss.ng'
                        }
                    }
                }
            );
            
            if (sendError || !result?.success) {
                messagingResults.push({
                    phone: phone_number,
                    success: false,
                    error: sendError?.message || result?.error || 'Failed to send message'
                });
            } else {
                messagingResults.push({
                    phone: phone_number,
                    success: true,
                    channel: result.channel || 'sms'
                });
            }
        } catch (error: any) {
            console.error(`Error sending credentials to ${phone_number}:`, error);
            messagingResults.push({
                phone: phone_number,
                success: false,
                error: error.message || 'Unknown error'
            });
        }
        
        // Send to secondary phone if provided
        if (phone_number_2) {
            try {
                const { data: result, error: sendError } = await supabaseAdmin.functions.invoke(
                    'kudisms-send',
                    {
                        body: {
                            phone_number: phone_number_2,
                            school_id: school_id,
                            template_name: 'parent_credentials',
                            variables: {
                                parent_name: name,
                                username,
                                password,
                                school_name: schoolName,
                                app_url: 'https://upss.ng'
                            }
                        }
                    }
                );
                
                if (sendError || !result?.success) {
                    messagingResults.push({
                        phone: phone_number_2,
                        success: false,
                        error: sendError?.message || result?.error || 'Failed to send message'
                    });
                } else {
                    messagingResults.push({
                        phone: phone_number_2,
                        success: true,
                        channel: result.channel || 'sms'
                    });
                }
            } catch (error: any) {
                console.error(`Error sending credentials to ${phone_number_2}:`, error);
                messagingResults.push({
                    phone: phone_number_2,
                    success: false,
                    error: error.message || 'Unknown error'
                });
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            credential: { username, password },
            linkResults,
            messagingResults 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'link_parent_to_student') {
        const { parent_id, student_id, relationship } = body;
        
        if (!parent_id || !student_id || !relationship) {
            throw new Error('parent_id, student_id, and relationship are required');
        }
        
        const { error } = await supabaseAdmin.from('parent_student_links').insert({
            parent_id,
            student_id,
            relationship
        });
        
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'unlink_parent_from_student') {
        const { parent_id, student_id } = body;
        
        if (!parent_id || !student_id) {
            throw new Error('parent_id and student_id are required');
        }
        
        const { error } = await supabaseAdmin
            .from('parent_student_links')
            .delete()
            .eq('parent_id', parent_id)
            .eq('student_id', student_id);
        
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'bulk_create_parent_accounts') {
        const { school_id } = body;
        
        if (!school_id) {
            throw new Error('school_id is required');
        }
        
        console.log(`Bulk creating parent accounts for school ${school_id}`);
        
        // Get all students with parent contact information
        const { data: students, error: studentsError } = await supabaseAdmin
            .from('students')
            .select('id, name, father_name, father_phone, mother_name, mother_phone, school_id')
            .eq('school_id', school_id);
        
        if (studentsError) throw studentsError;
        
        const results: any[] = [];
        const createdParents = new Map<string, string>(); // phone -> parent_id
        
        for (const student of students || []) {
            // Process father
            if (student.father_name && student.father_phone) {
                const phone = student.father_phone.trim();
                
                if (!createdParents.has(phone)) {
                    try {
                        const cleanName = student.father_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const username = `parent_${cleanName}${Date.now().toString().slice(-4)}`;
                        const password = `Parent${Math.floor(1000 + Math.random() * 9000)}!`;
                        const email = `${username}@upsshub.com`;
                        
                        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
                            email,
                            password,
                            email_confirm: true,
                            user_metadata: {
                                name: student.father_name,
                                username,
                                user_type: 'parent',
                                initial_password: password,
                                school_id: student.school_id,
                                phone_number: phone
                            }
                        });
                        
                        if (!userError && user) {
                            createdParents.set(phone, user.user.id);
                            
                            // Link to student
                            await supabaseAdmin.from('parent_student_links').insert({
                                parent_id: user.user.id,
                                student_id: student.id,
                                relationship: 'Father',
                                is_primary_contact: true
                            });
                            
                            results.push({
                                name: student.father_name,
                                phone,
                                username,
                                status: 'Success'
                            });
                        } else {
                            results.push({
                                name: student.father_name,
                                phone,
                                status: 'Failed',
                                error: userError?.message
                            });
                        }
                    } catch (error: any) {
                        results.push({
                            name: student.father_name,
                            phone,
                            status: 'Error',
                            error: error.message
                        });
                    }
                } else {
                    // Parent already created, just link
                    const parentId = createdParents.get(phone);
                    await supabaseAdmin.from('parent_student_links').insert({
                        parent_id: parentId,
                        student_id: student.id,
                        relationship: 'Father'
                    });
                }
            }
            
            // Process mother
            if (student.mother_name && student.mother_phone) {
                const phone = student.mother_phone.trim();
                
                if (!createdParents.has(phone)) {
                    try {
                        const cleanName = student.mother_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const username = `parent_${cleanName}${Date.now().toString().slice(-4)}`;
                        const password = `Parent${Math.floor(1000 + Math.random() * 9000)}!`;
                        const email = `${username}@upsshub.com`;
                        
                        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
                            email,
                            password,
                            email_confirm: true,
                            user_metadata: {
                                name: student.mother_name,
                                username,
                                user_type: 'parent',
                                initial_password: password,
                                school_id: student.school_id,
                                phone_number: phone
                            }
                        });
                        
                        if (!userError && user) {
                            createdParents.set(phone, user.user.id);
                            
                            // Link to student
                            await supabaseAdmin.from('parent_student_links').insert({
                                parent_id: user.user.id,
                                student_id: student.id,
                                relationship: 'Mother',
                                is_primary_contact: false
                            });
                            
                            results.push({
                                name: student.mother_name,
                                phone,
                                username,
                                status: 'Success'
                            });
                        } else {
                            results.push({
                                name: student.mother_name,
                                phone,
                                status: 'Failed',
                                error: userError?.message
                            });
                        }
                    } catch (error: any) {
                        results.push({
                            name: student.mother_name,
                            phone,
                            status: 'Error',
                            error: error.message
                        });
                    }
                } else {
                    // Parent already created, just link
                    const parentId = createdParents.get(phone);
                    await supabaseAdmin.from('parent_student_links').insert({
                        parent_id: parentId,
                        student_id: student.id,
                        relationship: 'Mother'
                    });
                }
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            results,
            totalProcessed: results.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // ============================================================================
    // BULK RETRIEVE PASSWORDS ACTION
    // ============================================================================
    
    if (action === 'bulk_retrieve_passwords') {
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            throw new Error("studentIds array is required");
        }

        console.log(`Bulk retrieve passwords for ${studentIds.length} students`);
        const results = [];

        for (const id of studentIds) {
            try {
                // Get student record to fetch user_id
                const { data: student, error: fetchError } = await supabaseAdmin
                    .from('students')
                    .select('id, name, user_id')
                    .eq('id', id)
                    .single();
                
                if (fetchError || !student) {
                    results.push({ 
                        id, 
                        name: `ID: ${id}`, 
                        status: 'Failed', 
                        error: 'Student not found' 
                    });
                    continue;
                }

                if (!student.user_id) {
                    results.push({ 
                        id, 
                        name: student.name, 
                        status: 'Failed', 
                        error: 'No account exists' 
                    });
                    continue;
                }

                // Get auth user to retrieve credentials from metadata
                const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(student.user_id);
                
                if (authError || !authUser?.user) {
                    results.push({ 
                        id, 
                        name: student.name, 
                        status: 'Failed', 
                        error: 'Auth user not found' 
                    });
                    continue;
                }

                const username = authUser.user.user_metadata?.username || authUser.user.email?.split('@')[0] || '';
                const password = authUser.user.user_metadata?.initial_password;

                if (!password) {
                    results.push({ 
                        id, 
                        name: student.name, 
                        username,
                        status: 'Failed', 
                        error: 'Password not found in metadata' 
                    });
                    continue;
                }

                results.push({
                    id,
                    name: student.name,
                    username,
                    password,
                    status: 'Success'
                });
            } catch (error: any) {
                console.error(`Error retrieving password for student ${id}:`, error);
                results.push({ 
                    id, 
                    name: `ID: ${id}`, 
                    status: 'Failed', 
                    error: error.message 
                });
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            credentials: results 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // ============================================================================
    // REPAIR USERNAMES ACTION
    // ============================================================================
    
    if (action === 'repair_usernames') {
        console.log('repair_usernames action called');
        
        const { school_id } = body;
        
        if (!school_id) {
            throw new Error('school_id is required');
        }
        
        console.log(`Repairing usernames for school ${school_id}`);
        
        // Find all student accounts where email doesn't match firstname.lastname@upsshub.com pattern
        // Pattern check: should have exactly one dot before @upsshub.com
        const { data: students, error: studentsError } = await supabaseAdmin
            .from('students')
            .select('id, name, email, user_id, school_id')
            .eq('school_id', school_id)
            .not('user_id', 'is', null)
            .like('email', '%@upsshub.com');
        
        if (studentsError) {
            throw new Error(`Failed to fetch students: ${studentsError.message}`);
        }
        
        console.log(`Found ${students?.length || 0} students with @upsshub.com emails`);
        
        // Filter students with legacy username format (no dot in username or numeric suffix without dot)
        // Proper format: firstname.lastname or firstname.lastname1 (optional numeric suffix)
        const legacyStudents = (students || []).filter(student => {
            const emailUsername = student.email.replace('@upsshub.com', '');
            // Check if username matches firstname.lastname pattern (optional numeric suffix for duplicates)
            const hasProperFormat = /^[a-z]+\.[a-z]+(\d+)?$/.test(emailUsername);
            return !hasProperFormat;
        });
        
        console.log(`Identified ${legacyStudents.length} students with legacy username format`);
        
        const results = [];
        
        // Collect existing usernames to avoid duplicates
        const existingUsernames = new Set<string>(
            (students || []).map(s => s.email.replace('@upsshub.com', ''))
        );
        
        // Fetch all auth user metadata upfront to avoid N+1 queries
        const userMetadataMap = new Map<string, any>();
        for (const student of legacyStudents) {
            try {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(student.user_id);
                if (authUser?.user) {
                    userMetadataMap.set(student.user_id, authUser.user.user_metadata || {});
                }
            } catch (e) {
                console.error(`Failed to fetch metadata for user ${student.user_id}:`, e);
                userMetadataMap.set(student.user_id, {});
            }
        }
        
        for (const student of legacyStudents) {
            try {
                console.log(`Processing student: ${student.name}, current email: ${student.email}`);
                
                // Generate new username using generateUsernameFromName
                const newUsername = generateUsernameFromName(student.name, existingUsernames);
                const newEmail = `${newUsername}@upsshub.com`;
                
                // Skip if the new email is the same as current
                if (newEmail === student.email) {
                    console.log(`Skipping ${student.name} - already has correct format`);
                    results.push({
                        name: student.name,
                        oldEmail: student.email,
                        newEmail: newEmail,
                        status: 'Skipped',
                        reason: 'Already correct format'
                    });
                    continue;
                }
                
                // Get existing metadata
                const existingMetadata = userMetadataMap.get(student.user_id) || {};
                
                // Update auth user email and metadata
                const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
                    student.user_id,
                    {
                        email: newEmail,
                        email_confirm: true,
                        user_metadata: {
                            ...existingMetadata,
                            username: newUsername
                        }
                    }
                );
                
                if (updateAuthError) {
                    console.error(`Failed to update auth user for ${student.name}:`, updateAuthError);
                    results.push({
                        name: student.name,
                        oldEmail: student.email,
                        newEmail: newEmail,
                        status: 'Failed',
                        error: updateAuthError.message
                    });
                    continue;
                }
                
                // Update student record email
                const { error: updateStudentError } = await supabaseAdmin
                    .from('students')
                    .update({ email: newEmail })
                    .eq('id', student.id);
                
                if (updateStudentError) {
                    console.error(`Failed to update student record for ${student.name}:`, updateStudentError);
                    results.push({
                        name: student.name,
                        oldEmail: student.email,
                        newEmail: newEmail,
                        status: 'Partial',
                        error: `Auth updated but student record failed: ${updateStudentError.message}`
                    });
                } else {
                    console.log(`Successfully updated ${student.name}: ${student.email} -> ${newEmail}`);
                    results.push({
                        name: student.name,
                        oldEmail: student.email,
                        newEmail: newEmail,
                        status: 'Success'
                    });
                    
                    // Add to existing usernames set to prevent duplicates in this batch
                    existingUsernames.add(newUsername);
                }
                
            } catch (error: any) {
                console.error(`Error repairing username for ${student.name}:`, error);
                results.push({
                    name: student.name,
                    oldEmail: student.email,
                    status: 'Error',
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.status === 'Success').length;
        console.log(`Username repair completed. ${successCount}/${legacyStudents.length} repaired successfully`);
        
        return new Response(JSON.stringify({ 
            success: true, 
            results,
            summary: {
                total: legacyStudents.length,
                repaired: successCount,
                failed: results.filter(r => r.status === 'Failed' || r.status === 'Error').length,
                skipped: results.filter(r => r.status === 'Skipped').length
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Manage Users Function Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
