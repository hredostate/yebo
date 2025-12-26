# KudiSMS Test Panel Improvements

## Summary of Changes

This update improves the Test Panel in `KudiSmsSettings.tsx` to properly route WhatsApp test messages through Green-API when configured, and provides a better user experience for testing messages.

## Key Improvements

### 1. **Proper Green-API Integration**
- The Test Panel now uses the `testSendMessage` service function instead of directly calling `kudisms-send`
- WhatsApp messages automatically use Green-API when configured, with fallback to KudiSMS
- SMS messages continue to use KudiSMS as before

### 2. **Provider Indicator**
- Visual indicator showing which provider will be used:
  - **Green-API** (green badge) - When Green-API is configured for WhatsApp
  - **KudiSMS** (orange badge) - For SMS or when Green-API is not configured
- Includes explanatory text about the routing behavior

### 3. **Per-Variable Input Fields**
- Replaced single comma-separated params field with individual labeled input fields
- Each template variable gets its own input field with a human-readable label
- Example: `student_name` becomes "Student Name", `amount` becomes "Amount"
- Validates that all variables are filled before sending

### 4. **Message Preview**
- Real-time preview showing the message with variables substituted
- Character count and page count display
- Updates automatically as you type in variable fields
- Helps verify the message looks correct before sending

## Technical Details

### Modified Files
- `src/components/KudiSmsSettings.tsx` - Main component with Test Panel UI
- `tests/kudismsTestPanel.test.ts` - New test validating routing logic

### New State Variables
```typescript
const [testVariables, setTestVariables] = useState<Record<string, string>>({});
const [messagePreview, setMessagePreview] = useState<string>('');
const [providerType, setProviderType] = useState<'greenapi' | 'kudisms' | null>(null);
```

### New Functions
- `detectProvider()` - Checks if Green-API is configured for the school
- `updateMessagePreview()` - Renders message preview with variable substitution
- `handleTemplateChange()` - Initializes variable fields when template is selected

### Routing Logic
1. When message type is **SMS**: Always uses KudiSMS
2. When message type is **WhatsApp**:
   - Checks `greenapi_settings` table for active configuration
   - If Green-API configured: Uses Green-API with `sms_templates`
   - If not configured: Falls back to KudiSMS WhatsApp

## Testing

The test file `tests/kudismsTestPanel.test.ts` validates:
- SMS always uses KudiSMS regardless of Green-API configuration
- WhatsApp uses Green-API when configured
- WhatsApp falls back to KudiSMS when Green-API is not configured
- Template variable substitution works correctly
- Detection of missing variables

## Usage

1. Navigate to **Settings** → **KudiSMS** → **Test Panel**
2. Select message type (SMS or WhatsApp)
3. View the **Provider** indicator to see which service will be used
4. Enter recipient phone number
5. Select a template from the dropdown
6. Fill in all template variables in the individual fields
7. Review the **Message Preview** to verify the message
8. Click **Send Test** to send the message

## Benefits

- **Correct routing**: WhatsApp tests now properly use Green-API when configured
- **Better UX**: Individual fields are easier to use than comma-separated values
- **Validation**: Prevents sending incomplete messages
- **Transparency**: Clear indication of which provider will be used
- **Preview**: See exactly what message will be sent before sending it
