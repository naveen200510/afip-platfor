import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Download } from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart as RechartsLineChart, 
  Line, 
  BarChart as RechartsBarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  Tooltip 
} from 'recharts';
import api from '../utils/api';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  voiceTranscript?: string;
  onVoiceHandled?: () => void;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  chartConfig?: any;
  hasPdf?: boolean;
  pdfPath?: string;
}

const COLORS = ['#00f2fe', '#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#a855f7'];

const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose, voiceTranscript, onVoiceHandled }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Hello! I am your AI Financial Copilot. Ask me questions about department spends, salaries, anomalies, why profits decreased, or type "Create PDF" to compile a report.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cancel speech when closing chatbot drawer
  useEffect(() => {
    if (!isOpen && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // Handle Voice Transcripts passed from Header
  useEffect(() => {
    if (voiceTranscript && voiceTranscript.trim()) {
      handleSendMessage(voiceTranscript);
      if (onVoiceHandled) onVoiceHandled();
    }
  }, [voiceTranscript]);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    // 1. Add user message
    setMessages(prev => [...prev, { sender: 'user', text, timestamp: new Date() }]);
    setInputValue('');
    setLoading(true);

    try {
      // 2. Fetch bot reply
      const response = await api.post('/ai/query', { prompt: text });
      const { answer, chart_config, has_pdf, pdf_path } = response.data;

      // 3. Add bot message
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: answer,
          timestamp: new Date(),
          chartConfig: chart_config,
          hasPdf: has_pdf,
          pdfPath: pdf_path
        }
      ]);

      // Voice Output: Read answer aloud if speech synthesis is available
      if ('speechSynthesis' in window) {
        const speechText = answer.replace(/\*\*/g, '').replace(/^- /gm, '');
        const utterance = new SpeechSynthesisUtterance(speechText);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: 'I ran into an issue communicating with the AI model. Please verify that the backend is active.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Render dynamic charts inside chatbot bubbles
  const renderBotChart = (chartConfig: any) => {
    if (!chartConfig || !chartConfig.data || chartConfig.data.length === 0) return null;
    const { type, data, title } = chartConfig;

    return (
      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: 'rgba(7, 11, 19, 0.6)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)',
        height: '180px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#00f2fe', marginBottom: '6px', textAlign: 'center' }}>
          {title}
        </div>
        <ResponsiveContainer width="100%" height="90%">
          {type === 'line' ? (
            <RechartsLineChart data={data}>
              <XAxis dataKey="year" stroke="#9ca3af" fontSize={9} />
              <Tooltip contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Line type="monotone" dataKey="Profit" stroke="#00f2fe" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={1} dot={{ r: 2 }} />
            </RechartsLineChart>
          ) : type === 'bar' ? (
            <RechartsBarChart data={data}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={8} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          ) : type === 'pie' ? (
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={45}
                dataKey="value"
                label={({ name }) => (name || '').substring(0, 5)}
                labelLine={false}
              >
                {data.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          ) : null}
        </ResponsiveContainer>
      </div>
    );
  };

  const handleDownloadPDF = (url: string) => {
    window.open(`http://localhost:8081${url}`, '_blank');
  };

  return (
    <div className={`chatbot-drawer ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#00f2fe" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>AI CFO Copilot</h3>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.sender}`} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{msg.text}</div>
            
            {/* Conditional chart rendering */}
            {msg.chartConfig && renderBotChart(msg.chartConfig)}

            {/* Conditional PDF download rendering */}
            {msg.hasPdf && msg.pdfPath && (
              <button
                onClick={() => handleDownloadPDF(msg.pdfPath!)}
                style={{
                  marginTop: '10px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <Download size={14} /> Download PDF Statement
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble bot" style={{ display: 'flex', gap: '6px', padding: '12px' }}>
            <span style={{ animation: 'bounce 1.4s infinite 0.2s', width: '6px', height: '6px', background: '#00f2fe', borderRadius: '50%' }}></span>
            <span style={{ animation: 'bounce 1.4s infinite 0.4s', width: '6px', height: '6px', background: '#00f2fe', borderRadius: '50%' }}></span>
            <span style={{ animation: 'bounce 1.4s infinite 0.6s', width: '6px', height: '6px', background: '#00f2fe', borderRadius: '50%' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, padding: '10px' }}
          placeholder="Ask AI CFO..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
        />
        <button
          onClick={() => handleSendMessage(inputValue)}
          style={{
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))',
            color: '#ffffff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={16} />
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
};

export default ChatBot;
export type { Message };
