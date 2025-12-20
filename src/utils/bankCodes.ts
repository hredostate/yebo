// Nigerian bank codes mapping
export const BANK_CODES: Record<string, string> = {
    '044': 'Access Bank',
    '023': 'Citibank Nigeria',
    '063': 'Diamond Bank',
    '050': 'Ecobank Nigeria',
    '084': 'Enterprise Bank',
    '070': 'Fidelity Bank',
    '011': 'First Bank of Nigeria',
    '214': 'First City Monument Bank',
    '058': 'Guaranty Trust Bank',
    '030': 'Heritage Bank',
    '301': 'Jaiz Bank',
    '082': 'Keystone Bank',
    '526': 'Parallex Bank',
    '076': 'Polaris Bank',
    '101': 'Providus Bank',
    '221': 'Stanbic IBTC Bank',
    '068': 'Standard Chartered Bank',
    '232': 'Sterling Bank',
    '100': 'Suntrust Bank',
    '032': 'Union Bank of Nigeria',
    '033': 'United Bank for Africa',
    '215': 'Unity Bank',
    '035': 'Wema Bank',
    '057': 'Zenith Bank',
};

export function getBankName(bankCode: string): string {
    return BANK_CODES[bankCode] || bankCode;
}

export function generateBankTransferCSV(payslips: any[], periodKey: string): string {
    const headers = ['Staff Name', 'Bank Name', 'Account Number', 'Account Name', 'Net Amount', 'Narration'];
    const rows = [headers];

    payslips.forEach((payslip) => {
        const staff = payslip.staff;
        if (staff && staff.account_number && staff.bank_code) {
            rows.push([
                staff.name || 'Unknown',
                getBankName(staff.bank_code),
                staff.account_number,
                staff.account_name || staff.name || '',
                payslip.net_pay.toFixed(2),
                `Salary payment for ${periodKey}`
            ]);
        }
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}
