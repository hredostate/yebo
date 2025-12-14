import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getErrorMessage } from '../services/kudiSmsService';
import Spinner from './common/Spinner';

interface KudiSmsTestPanelProps {
  schoolId: number;
  apiToken: string;
  defaultSenderId?: string;
  templateCodes?: Record<string, string>;
}

interface TestResponse {
  success: boolean;
  data?: any;
  error?: string;
  cost?: number;
  balance?: string;
  messageId?: string;
}

const KudiSmsTestPanel: React.FC<KudiSmsTestPanelProps> = ({ 
  schoolId, 
  apiToken,
  defaultSenderId = '',
  templateCodes = {}
}) => {
  const [messageType, setMessageType] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [recipient, setRecipient] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [parameters, setParameters] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [senderId, setSenderId] = useState(defaultSenderId);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  const handleCheckBalance = async () => {
    setCheckingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke('kudisms-test', {
        body: { 
          action: 'check_balance',
          token: apiToken 
        }
      });

      if (error) throw error;

      if (data?.balance) {
        setBalance(data.balance);
      } else {
        setBalance('Error fetching balance');
      }
    } catch (error: any) {
      console.error('Error checking balance:', error);
      setBalance('Error: ' + error.message);
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSendTest = async () => {
    // Validation
    if (!recipient.trim()) {
      alert('Please enter a recipient phone number');
      return;
    }

    if (messageType === 'whatsapp' && !templateCode.trim()) {
      alert('Please enter or select a template code');
      return;
    }

    if (messageType === 'sms' && !smsMessage.trim()) {
      alert('Please enter an SMS message');
      return;
    }

    if (messageType === 'sms' && !senderId.trim()) {
      alert('Please enter a sender ID for SMS');
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const body: any = {
        action: 'send_test',
        type: messageType,
        recipient: recipient.trim(),
        token: apiToken
      };

      if (messageType === 'whatsapp') {
        body.template_code = templateCode.trim();
        body.parameters = parameters.trim();
      } else {
        body.message = smsMessage.trim();
        body.senderID = senderId.trim();
      }

      const { data, error } = await supabase.functions.invoke('kudisms-test', {
        body
      });

      if (error) {
        setResponse({
          success: false,
          error: error.message
        });
        return;
      }

      // Parse the API response
      const apiResult = data?.result || data;
      
      if (apiResult?.status === 'success' || apiResult?.error_code === '000') {
        setResponse({
          success: true,
          data: apiResult,
          cost: apiResult.cost,
          balance: apiResult.balance,
          messageId: apiResult.data
        });
        // Update balance display
        if (apiResult.balance) {
          setBalance(apiResult.balance);
        }
      } else {
        setResponse({
          success: false,
          error: apiResult?.msg || 'Unknown error',
          data: apiResult
        });
      }
    } catch (error: any) {
      console.error('Error sending test:', error);
      setResponse({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kudi SMS Test Panel</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckBalance}
            disabled={checkingBalance || !apiToken}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            {checkingBalance ? <Spinner /> : 'Check Balance'}
          </button>
          {balance && (
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-md">
              <span className="text-sm font-medium text-green-800">
                Balance: ₦{balance}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Type
        </label>
        <div className="flex gap-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="messageType"
              value="whatsapp"
              checked={messageType === 'whatsapp'}
              onChange={(e) => setMessageType(e.target.value as 'whatsapp' | 'sms')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2">WhatsApp</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="messageType"
              value="sms"
              checked={messageType === 'sms'}
              onChange={(e) => setMessageType(e.target.value as 'whatsapp' | 'sms')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2">SMS</span>
          </label>
        </div>
      </div>

      {/* Recipient Phone */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recipient Phone Number
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="234XXXXXXXXXX"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Format: 234XXXXXXXXXX (Nigerian international format)
        </p>
      </div>

      {/* WhatsApp Fields */}
      {messageType === 'whatsapp' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Code
            </label>
            {Object.keys(templateCodes).length > 0 ? (
              <select
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a template...</option>
                {Object.entries(templateCodes).map(([name, code]) => (
                  <option key={name} value={code}>
                    {name} ({code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                placeholder="25XXXXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <p className="mt-1 text-xs text-gray-500">
              Template codes must be pre-approved in Kudi SMS dashboard
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parameters (comma-separated)
            </label>
            <input
              type="text"
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              placeholder="John,5000,REF123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Example: John,5000,REF123 (for name, amount, reference)
            </p>
          </div>
        </>
      )}

      {/* SMS Fields */}
      {messageType === 'sms' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sender ID
            </label>
            <input
              type="text"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              placeholder="YourSenderID"
              maxLength={11}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum 11 characters. Must be approved in Kudi SMS dashboard.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Hello {{name}}, your payment of {{amount}} was received"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum 6 pages allowed. Use {`{{variable}}`} for personalisation.
            </p>
          </div>
        </>
      )}

      {/* Send Button */}
      <div className="mb-6">
        <button
          onClick={handleSendTest}
          disabled={loading || !apiToken}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <Spinner />
          ) : (
            <>
              <span>🚀</span>
              <span>Send Test Message</span>
            </>
          )}
        </button>
      </div>

      {/* Response Display */}
      {response && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Response:</h3>
          
          {response.success ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-2xl">✅</span>
                <div className="flex-1">
                  <p className="font-semibold text-green-800 mb-2">
                    Message sent successfully!
                  </p>
                  {response.cost && (
                    <p className="text-sm text-green-700">
                      Cost: ₦{response.cost}
                    </p>
                  )}
                  {response.messageId && (
                    <p className="text-sm text-green-700">
                      Message ID: {response.messageId}
                    </p>
                  )}
                  {response.balance && (
                    <p className="text-sm text-green-700">
                      Remaining Balance: ₦{response.balance}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="font-semibold text-red-800 mb-2">
                    Failed to send message
                  </p>
                  <p className="text-sm text-red-700">
                    {response.error}
                  </p>
                  {response.data?.error_code && (
                    <p className="text-sm text-red-700 mt-1">
                      Error Code: {response.data.error_code} - {getErrorMessage(response.data.error_code)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Raw Response */}
          {response.data && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2 text-gray-700">Raw Response:</h4>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs overflow-x-auto">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KudiSmsTestPanel;
