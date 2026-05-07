import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

function ChatBox({ docId, initialHistory }) {
  const [messages, setMessages] = useState(initialHistory || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/api/chat/${docId}`, { message: input });
      setMessages(prev => [...prev, { role: 'model', content: res.data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, an error occurred.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Ask anything about this document...</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="msg-bubble">
              <div className="msg-content">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-message model">
            <div className="msg-bubble">
              <div className="msg-content typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input 
          type="text" 
          placeholder="Ask a question about this document..." 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary">Send</button>
      </form>
    </div>
  );
}

export default ChatBox;
