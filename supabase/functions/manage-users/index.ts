
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing Supabase URL or Service Key.');
    }

    // Service role client is required for admin.createUser and admin.updateUserById
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

                // If existing student already has an account, delete and clear user_id
                if (existingStudent?.user_id) {
                    // Delete existing auth user to "reset" the account
                    try {
                        await supabaseAdmin.auth.admin.deleteUser(existingStudent.user_id);
                        // Also manually clear the user_id from the student record for safety
                        const { error: clearError } = await supabaseAdmin
                            .from('students')
                            .update({ user_id: null })
                            .eq('id', existingStudent.id);
                        if (clearError) {
                            console.warn(`Could not clear user_id for ${studentName}:`, clearError);
                        }
                        console.log(`Deleted existing auth account and cleared user_id for ${studentName}`);
                    } catch (e) {
                        console.warn(`Could not delete existing account for ${studentName}:`, e);
                    }
                }

                // Generate username and password
                // Username format: admission number or name-based with school prefix
                const cleanAdmission = student.admission_number ? student.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                const cleanName = studentName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const username = cleanAdmission || `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
                const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
                
                // Use provided email (case-insensitive) or generate one with @upsshub.com domain
                // Email is still needed for Supabase Auth but username will be primary for students
                const emailPrefix = cleanAdmission || cleanName || 'student';
                const timestamp = Date.now().toString().slice(-6);
                const random = Math.floor(Math.random() * 1000);
                const email = providedEmail || `${emailPrefix}.${timestamp}${random}@upsshub.com`;

                console.log(`Student ${studentName}: username = "${username}", email = "${email}"`);

                console.log(`Creating auth user with email: ${email}`);

                const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
                    email: email,
                    password: password,
                    email_confirm: true,
                    user_metadata: {
                        name: studentName,
                        username: username, // Store username in metadata
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

                results.push({ name: studentName, username: username, email: email, password: password, status: 'Success' });
                
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

        const cleanAdmission = studentRecord.admission_number ? studentRecord.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const cleanName = studentRecord.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const username = cleanAdmission || `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
        const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
        const emailPrefix = cleanAdmission || cleanName;
        const email = studentRecord.email || `${emailPrefix}.${Math.floor(Math.random() * 1000)}@upsshub.com`;

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

        return new Response(JSON.stringify({ success: true, credential: { username, email, password } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    if (action === 'bulk_create_for_existing') {
        if (!studentIds || !Array.isArray(studentIds)) {
            throw new Error("studentIds array is required");
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

             const cleanAdmission = student.admission_number ? student.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
             const cleanName = student.name.toLowerCase().replace(/[^a-z0-9]/g, '');
             const username = cleanAdmission || `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
             const password = `Student${Math.floor(1000 + Math.random() * 9000)}!`;
             const emailPrefix = cleanAdmission || cleanName;
             const email = student.email || `${emailPrefix}.${Math.floor(Math.random() * 1000)}@upsshub.com`;

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

                results.push({ name: student.name, username, email, password, status: 'Success' });
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
        return new Response(JSON.stringify({ success: true, password: newPassword }), {
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

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Manage Users Function Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
