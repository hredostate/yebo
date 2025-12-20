# Offline Payroll Processing - Quick Start Guide

## Overview
Process payroll manually without automated Paystack transfers. Download bank transfer details and complete payments yourself.

## Prerequisites
- Payroll run must be in `FINALIZED` status
- User must have `manage-payroll` or `manage-finance` permission
- All staff payslips must be approved

## Step-by-Step Instructions

### 1. Navigate to Payroll Approval Dashboard
```
Menu → Payroll → Approval Dashboard
```

### 2. Select Your Finalized Payroll Run
- Click on the payroll run card for the period you want to process
- Verify status shows "FINALIZED"
- Review the approval summary (should show 100% approved)

### 3. Choose Processing Method
- In the "Process Payment" section
- Select: **💵 Offline (Manual Transfer)**
- Click: **"Process Payment via Offline"**

### 4. Confirm Offline Processing
A confirmation dialog will appear. Review the information:
- ✓ Payroll records will be created
- ✓ Run will be marked as "PROCESSED_OFFLINE"
- ✓ Bank transfer sheet will be available
- ⚠️ NO automated payments will be processed
- ⚠️ You must manually complete bank transfers

Click: **"Confirm Offline Processing"**

### 5. Wait for Processing
- A spinner will appear during processing
- Typically takes 2-5 seconds
- Success message will confirm completion

### 6. Download Bank Transfer Sheet
After processing completes:
- Green success banner appears
- Click: **"📥 Download Bank Transfer Sheet"**
- CSV file downloads automatically
- Filename format: `bank-transfer-{period}-{timestamp}.csv`

### 7. Review CSV File
Open the downloaded CSV file. Contains:
```csv
"Staff Name","Bank Name","Account Number","Account Name","Net Amount","Narration"
"John Doe","Guaranty Trust Bank","0123456789","John Doe","85000.00","Salary payment for January 2025"
```

### 8. Complete Bank Transfers

#### Option A: Upload to Internet Banking (Recommended)
1. Log into your bank's internet banking portal
2. Navigate to: Bulk Transfers or Salary Upload
3. Upload the CSV file
4. Review and authorize the batch
5. Complete the transfer

#### Option B: Manual Entry
1. Log into your bank's internet banking
2. For each row in the CSV:
   - Add new transfer
   - Enter: Account number, Bank, Amount, Narration
   - Submit transfer
3. Complete all transfers

### 9. Record Keeping
- Save the CSV file for your records
- Keep transaction receipts from the bank
- File as proof of salary payment
- Reference in accounting records

## CSV File Format

The downloaded CSV contains these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Staff Name | Employee full name | John Doe |
| Bank Name | Nigerian bank name | Guaranty Trust Bank |
| Account Number | 10-digit account number | 0123456789 |
| Account Name | Name on bank account | John Doe |
| Net Amount | Amount to transfer (NGN) | 85000.00 |
| Narration | Payment description | Salary payment for January 2025 |

## Troubleshooting

### "Payroll run must be in FINALIZED status"
**Problem:** Run hasn't been finalized yet  
**Solution:** 
1. Go back to Approval Dashboard
2. Wait for all staff to approve their payslips
3. Click "Finalize Payroll" button
4. Then try offline processing again

### "No finalized payslips found"
**Problem:** Staff haven't approved their payslips  
**Solution:**
1. Check approval progress (should be 100%)
2. Notify staff to approve pending payslips
3. Wait for all approvals
4. Finalize the run
5. Try again

### Download button not appearing
**Problem:** Processing hasn't completed  
**Solution:**
1. Refresh the page
2. Select the payroll run again
3. Status should show "PROCESSED_OFFLINE"
4. Download button should appear

### CSV download fails
**Problem:** Browser blocking download  
**Solution:**
1. Check browser download settings
2. Allow downloads from the site
3. Try again
4. Check browser console for errors

### Missing bank details in CSV
**Problem:** Staff profile lacks bank information  
**Solution:**
1. Go to User Management
2. Find the staff member
3. Edit profile → Add bank details:
   - Account Number
   - Bank Code
   - Account Name
4. Process offline payroll again

## Important Notes

⚠️ **Before Processing:**
- Verify sufficient funds in bank account
- Confirm all staff bank details are correct
- Review total amount in approval summary
- Ensure you have authorization to make transfers

✓ **After Processing:**
- Download CSV immediately
- Keep CSV file for audit purposes
- Complete transfers within 1-2 business days
- Notify staff when payments are made
- File transaction receipts

## Bank Codes Reference

Common Nigerian bank codes in the CSV:

| Code | Bank Name |
|------|-----------|
| 044 | Access Bank |
| 058 | Guaranty Trust Bank |
| 011 | First Bank of Nigeria |
| 214 | First City Monument Bank |
| 033 | United Bank for Africa |
| 057 | Zenith Bank |
| 032 | Union Bank of Nigeria |
| 076 | Polaris Bank |
| 221 | Stanbic IBTC Bank |
| 232 | Sterling Bank |

For complete list, see: `src/utils/bankCodes.ts`

## Security Best Practices

1. **Access Control**
   - Only authorized personnel should process payroll
   - Requires `manage-payroll` or `manage-finance` permission
   - Use strong passwords for internet banking

2. **Data Protection**
   - Store CSV files securely
   - Delete from downloads folder after upload
   - Don't email CSV files unencrypted
   - Use secure file sharing if needed

3. **Verification**
   - Double-check bank details before transfer
   - Verify total amount matches approval summary
   - Review narration/reference for accuracy
   - Confirm with accounting before processing

4. **Audit Trail**
   - System logs all offline processing actions
   - Keep transaction receipts from bank
   - File CSV with accounting records
   - Document any issues or corrections

## Support

Need help?
1. Check the detailed documentation: `OFFLINE_PAYROLL_IMPLEMENTATION.md`
2. Review test examples: `tests/offlinePayrollProcessing.test.ts`
3. Check audit logs in the system
4. Contact your system administrator

## Related Features

- **Payroll Pre-Run Manager**: Create and publish payroll runs
- **Payroll Approval Dashboard**: Review and approve payslips
- **Paystack Integration**: Automated payment processing
- **Audit Logs**: Track all payroll activities
- **Staff Portal**: Staff can view and approve payslips

## Keyboard Shortcuts

While in Payroll Approval Dashboard:
- `ESC` - Close confirmation dialog
- `Enter` - Confirm action in dialog

## Tips for Efficiency

1. **Schedule Processing**
   - Process offline payroll 2-3 days before payday
   - Allows time for bank processing
   - Gives buffer for any issues

2. **Batch Preparation**
   - Finalize all approval before month-end
   - Process offline at consistent time each month
   - Download CSV immediately after processing

3. **Communication**
   - Notify staff of payment schedule
   - Confirm when transfers are completed
   - Provide support contact for payment issues

4. **Record Keeping**
   - Name CSV files consistently
   - Store in organized folder structure
   - Keep for minimum 7 years (tax requirement)
   - Back up regularly
