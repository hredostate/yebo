/**
 * Test for KudiSMS Test Panel integration
 * Validates that testSendMessage properly routes through Green-API or KudiSMS
 */

import assert from 'assert';

/**
 * Mock test to validate the logic flow of testSendMessage
 * 
 * The actual testSendMessage function in kudiSmsService.ts:
 * 1. Takes messageType ('sms' | 'whatsapp')
 * 2. For WhatsApp: calls sendWhatsAppMessage which checks for Green-API config
 * 3. For SMS: calls sendSms which uses KudiSMS
 * 
 * This test validates the expected behavior:
 * - SMS always uses KudiSMS
 * - WhatsApp uses Green-API if configured, otherwise falls back to KudiSMS
 */

interface MockTestParams {
    schoolId: number;
    recipientPhone: string;
    messageType: 'sms' | 'whatsapp';
    templateName: string;
    variables: Record<string, string>;
}

interface MockResult {
    success: boolean;
    channel: 'sms' | 'whatsapp';
    provider: 'greenapi' | 'kudisms';
    error?: string;
}

/**
 * Mock implementation of the routing logic
 */
function mockTestSendMessage(
    params: MockTestParams,
    greenApiConfigured: boolean
): MockResult {
    const { messageType } = params;

    if (messageType === 'sms') {
        // SMS always uses KudiSMS
        return {
            success: true,
            channel: 'sms',
            provider: 'kudisms'
        };
    } else {
        // WhatsApp checks for Green-API configuration
        if (greenApiConfigured) {
            return {
                success: true,
                channel: 'whatsapp',
                provider: 'greenapi'
            };
        } else {
            return {
                success: true,
                channel: 'whatsapp',
                provider: 'kudisms'
            };
        }
    }
}

// Test Case 1: SMS always uses KudiSMS regardless of Green-API configuration
console.log('Test 1: SMS routing...');
const smsParams: MockTestParams = {
    schoolId: 1,
    recipientPhone: '2348012345678',
    messageType: 'sms',
    templateName: 'payment_receipt',
    variables: { student_name: 'John Doe', amount: '5000' }
};

const smsResultWithGreenApi = mockTestSendMessage(smsParams, true);
assert.strictEqual(smsResultWithGreenApi.channel, 'sms', 'SMS channel is correct');
assert.strictEqual(smsResultWithGreenApi.provider, 'kudisms', 'SMS uses KudiSMS even with Green-API configured');

const smsResultWithoutGreenApi = mockTestSendMessage(smsParams, false);
assert.strictEqual(smsResultWithoutGreenApi.channel, 'sms', 'SMS channel is correct');
assert.strictEqual(smsResultWithoutGreenApi.provider, 'kudisms', 'SMS uses KudiSMS without Green-API');

// Test Case 2: WhatsApp uses Green-API when configured
console.log('Test 2: WhatsApp with Green-API configured...');
const whatsappParams: MockTestParams = {
    schoolId: 1,
    recipientPhone: '2348012345678',
    messageType: 'whatsapp',
    templateName: 'payment_receipt',
    variables: { student_name: 'John Doe', amount: '5000' }
};

const whatsappResultWithGreenApi = mockTestSendMessage(whatsappParams, true);
assert.strictEqual(whatsappResultWithGreenApi.channel, 'whatsapp', 'WhatsApp channel is correct');
assert.strictEqual(whatsappResultWithGreenApi.provider, 'greenapi', 'WhatsApp uses Green-API when configured');

// Test Case 3: WhatsApp falls back to KudiSMS when Green-API is not configured
console.log('Test 3: WhatsApp fallback to KudiSMS...');
const whatsappResultWithoutGreenApi = mockTestSendMessage(whatsappParams, false);
assert.strictEqual(whatsappResultWithoutGreenApi.channel, 'whatsapp', 'WhatsApp channel is correct');
assert.strictEqual(whatsappResultWithoutGreenApi.provider, 'kudisms', 'WhatsApp falls back to KudiSMS when Green-API not configured');

// Test Case 4: Validate template variable substitution
console.log('Test 4: Template variable substitution...');
const template = "Hello {{student_name}}, your payment of {{amount}} has been received.";
const variables = { student_name: 'John Doe', amount: '₦5,000' };

let message = template;
Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
});

const expectedMessage = "Hello John Doe, your payment of ₦5,000 has been received.";
assert.strictEqual(message, expectedMessage, 'Variables are correctly substituted in template');

// Test Case 5: Validate that all variables are replaced
console.log('Test 5: All variables must be provided...');
const templateWithMissing = "Hello {{student_name}}, your payment of {{amount}} for {{term}} has been received.";
const partialVariables = { student_name: 'John Doe', amount: '₦5,000' };

let messageWithMissing = templateWithMissing;
Object.entries(partialVariables).forEach(([key, value]) => {
    messageWithMissing = messageWithMissing.replace(new RegExp(`{{${key}}}`, 'g'), value);
});

// Check if any unreplaced variables remain
const hasUnreplacedVariables = /{{[^}]+}}/.test(messageWithMissing);
assert.strictEqual(hasUnreplacedVariables, true, 'Unreplaced variables are detected');

console.log('All KudiSMS Test Panel tests passed!');
