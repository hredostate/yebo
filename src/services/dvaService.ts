/**
 * DVA Service - Manages Dedicated Virtual Account operations
 * Handles campus-based API routing, DVA generation, SMS notifications, and lifecycle management
 */

import type { Student, DedicatedVirtualAccount, PaystackApiSettings } from '../types';
import { requireSupabaseClient } from './supabaseClient';
import * as paystackService from './paystackService';
import { sendSmsNotification } from './smsService';

/**
 * Get the appropriate Paystack API settings for a student based on campus
 * Priority: Student's campus_id > Class's campus_id > School default
 */
export async function getCampusApiKey(
    schoolId: number,
    student: Student
): Promise<PaystackApiSettings | null> {
    const supabase = requireSupabaseClient();
    
    // Determine which campus to use
    let campusId: number | null = null;
    
    // First priority: Student's direct campus assignment
    if (student.campus_id) {
        campusId = student.campus_id;
    } 
    // Second priority: Class's campus assignment
    else if (student.class_id) {
        const { data: classData } = await supabase
            .from('classes')
            .select('campus_id')
            .eq('id', student.class_id)
            .single();
        
        if (classData?.campus_id) {
            campusId = classData.campus_id;
        }
    }
    
    // Fetch API settings - try campus-specific first, then fall back to default
    const { data: settingsData, error: settingsError } = await supabase
        .from('paystack_api_settings')
        .select('*')
        .eq('school_id', schoolId)
        .eq('enabled', true)
        .order('campus_id', { ascending: false, nullsFirst: false })
        .limit(1);
    
    if (settingsError) {
        console.error('Error fetching API settings:', settingsError);
        return null;
    }
    
    // If we have a specific campus, try to find its settings
    if (campusId && settingsData) {
        const campusSettings = settingsData.find((s: PaystackApiSettings) => s.campus_id === campusId);
        if (campusSettings) {
            return campusSettings;
        }
    }
    
    // Fall back to default (campus_id = null) or first available
    return settingsData && settingsData.length > 0 ? settingsData[0] : null;
}

/**
 * Generate DVA for a single student using campus-specific API
 */
export async function generateDVAForStudent(
    student: Student,
    schoolId: number,
    preferredBank: string
): Promise<DedicatedVirtualAccount> {
    const supabase = requireSupabaseClient();
    
    // Validate student data
    if (!student.name || student.name.trim() === '') {
        throw new Error('Student name is required');
    }
    
    // Check if DVA already exists
    const { data: existingDVA } = await supabase
        .from('dedicated_virtual_accounts')
        .select('*')
        .eq('student_id', student.id)
        .single();
    
    if (existingDVA) {
        throw new Error('Student already has a dedicated virtual account');
    }
    
    // Get appropriate API settings
    const apiSettings = await getCampusApiKey(schoolId, student);
    if (!apiSettings) {
        throw new Error('Paystack API settings not configured for this campus');
    }
    
    // Create Paystack customer
    const customerId = await paystackService.createOrGetPaystackCustomer(
        apiSettings.secret_key,
        student
    );
    
    // Create dedicated virtual account
    const dvaResponse = await paystackService.createDedicatedVirtualAccount(
        apiSettings.secret_key,
        customerId,
        preferredBank
    );
    
    // Save to database
    const { data, error } = await supabase
        .from('dedicated_virtual_accounts')
        .insert([{
            school_id: schoolId,
            student_id: student.id,
            account_number: dvaResponse.data.account_number,
            account_name: dvaResponse.data.account_name,
            bank_name: dvaResponse.data.bank.name,
            bank_slug: dvaResponse.data.bank.slug,
            bank_id: dvaResponse.data.bank.id,
            currency: dvaResponse.data.currency,
            active: dvaResponse.data.active,
            assigned: dvaResponse.data.assigned,
            paystack_account_id: dvaResponse.data.id,
            paystack_customer_id: customerId
        }])
        .select('*, student:students(name, admission_number)')
        .single();
    
    if (error) throw error;
    
    return data;
}

/**
 * Send DVA details to parent via SMS
 * Sends to both parent phone numbers if available
 */
export async function sendDVADetailsToParents(
    student: Student,
    dva: DedicatedVirtualAccount,
    schoolId: number,
    sentBy: string
): Promise<{ sent: number; failed: number }> {
    const supabase = requireSupabaseClient();
    
    // Get school name for template
    const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single();
    
    const schoolName = school?.name || 'School';
    
    // Prepare template variables
    const variables = {
        student_name: student.name,
        bank_name: dva.bank_name,
        account_number: dva.account_number,
        account_name: dva.account_name,
        school_name: schoolName
    };
    
    let sent = 0;
    let failed = 0;
    
    // Get parent phone numbers (use new fields with fallback to deprecated fields)
    const phone1 = student.father_phone || student.parent_phone_number_1;
    const phone2 = student.mother_phone || student.parent_phone_number_2;
    
    // Send to first parent phone
    if (phone1 && phone1.trim() !== '') {
        try {
            const success = await sendSmsNotification({
                schoolId,
                studentId: student.id,
                recipientPhone: phone1,
                templateName: 'dva_account_created',
                variables,
                notificationType: 'dva_account_created',
                sentBy,
                referenceId: dva.id
            });
            if (success) sent++;
            else failed++;
        } catch (error) {
            console.error('Error sending to parent phone 1:', error);
            failed++;
        }
    }
    
    // Send to second parent phone (if different from first)
    if (phone2 && phone2.trim() !== '' && phone2 !== phone1) {
        try {
            const success = await sendSmsNotification({
                schoolId,
                studentId: student.id,
                recipientPhone: phone2,
                templateName: 'dva_account_created',
                variables,
                notificationType: 'dva_account_created',
                sentBy,
                referenceId: dva.id
            });
            if (success) sent++;
            else failed++;
        } catch (error) {
            console.error('Error sending to parent phone 2:', error);
            failed++;
        }
    }
    
    return { sent, failed };
}

/**
 * Delete (deactivate) a DVA
 */
export async function deleteDVA(
    dva: DedicatedVirtualAccount,
    apiKey: string
): Promise<void> {
    const supabase = requireSupabaseClient();
    
    // Deactivate on Paystack if ID is available
    if (dva.paystack_account_id) {
        await paystackService.deactivateDedicatedVirtualAccount(
            apiKey,
            dva.paystack_account_id
        );
    }
    
    // Update in database
    const { error } = await supabase
        .from('dedicated_virtual_accounts')
        .update({ active: false, assigned: false })
        .eq('id', dva.id);
    
    if (error) throw error;
}

/**
 * Regenerate DVA for a student (delete old, create new)
 */
export async function regenerateDVA(
    studentId: number,
    schoolId: number,
    preferredBank: string,
    currentUser: string
): Promise<DedicatedVirtualAccount> {
    const supabase = requireSupabaseClient();
    
    // Get student
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();
    
    if (studentError || !student) {
        throw new Error('Student not found');
    }
    
    // Get existing DVA
    const { data: existingDVA } = await supabase
        .from('dedicated_virtual_accounts')
        .select('*')
        .eq('student_id', studentId)
        .single();
    
    if (existingDVA) {
        // Get API settings
        const apiSettings = await getCampusApiKey(schoolId, student);
        if (!apiSettings) {
            throw new Error('Paystack API settings not configured');
        }
        
        // Delete old DVA
        await deleteDVA(existingDVA, apiSettings.secret_key);
        
        // Delete from database to allow new creation
        await supabase
            .from('dedicated_virtual_accounts')
            .delete()
            .eq('id', existingDVA.id);
    }
    
    // Create new DVA
    const newDVA = await generateDVAForStudent(student, schoolId, preferredBank);
    
    // Send to parents
    await sendDVADetailsToParents(student, newDVA, schoolId, currentUser);
    
    return newDVA;
}
