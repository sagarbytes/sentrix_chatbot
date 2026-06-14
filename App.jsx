import React, { useState, useEffect, useRef } from 'react';

// --- SYNTAX HIGHLIGHTING HELPERS ---

function highlightPython(code) {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Python keywords
  const keywords = [
    'def', 'class', 'return', 'import', 'from', 'if', 'else', 'elif', 
    'for', 'while', 'in', 'and', 'or', 'not', 'is', 'None', 'True', 
    'False', 'try', 'except', 'as', 'pass', 'with', 'global', 'nonlocal', 'lambda'
  ];
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  escaped = escaped.replace(keywordRegex, '<span style="color: #ff7b72; font-weight: 500;">$1</span>');
  
  // Comments (starting with #)
  escaped = escaped.replace(/(#[^\n]*)/g, '<span style="color: #8b949e; font-style: italic;">$1</span>');
  
  // Strings
  escaped = escaped.replace(/("[^"]*")/g, '<span style="color: #a5d6ff;">$1</span>');
  escaped = escaped.replace(/('[^']*')/g, '<span style="color: #a5d6ff;">$1</span>');
  
  // Builtins/functions
  const functions = ['print', 'len', 'range', 'str', 'int', 'dict', 'list', 'set', 'get_db_connection', 'execute', 'fetchone', 'close'];
  const funcRegex = new RegExp(`\\b(${functions.join('|')})\\b`, 'g');
  escaped = escaped.replace(funcRegex, '<span style="color: #d2a6ff;">$1</span>');

  return <code style={{ fontFamily: 'var(--font-mono)' }} dangerouslySetInnerHTML={{ __html: escaped }} />;
}

function highlightSQL(code) {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // SQL keywords
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'UPDATE', 'DELETE', 
    'INTO', 'VALUES', 'SET', 'CREATE', 'TABLE', 'DROP', 'INDEX', 'JOIN', 
    'LEFT', 'RIGHT', 'INNER', 'ON', 'AS', 'UNION', 'ALL', 'LIMIT', 'ORDER', 'BY'
  ];
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  escaped = escaped.replace(keywordRegex, '<span style="color: #ff7b72; font-weight: 500;">$1</span>');
  
  // Comments
  escaped = escaped.replace(/(--[^\n]*)/g, '<span style="color: #8b949e; font-style: italic;">$1</span>');
  
  // Strings
  escaped = escaped.replace(/('[^']*')/g, '<span style="color: #a5d6ff;">$1</span>');
  
  return <code style={{ fontFamily: 'var(--font-mono)' }} dangerouslySetInnerHTML={{ __html: escaped }} />;
}

function highlightJS(code) {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // JS keywords
  const keywords = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 
    'while', 'import', 'export', 'default', 'from', 'class', 'extends',
    'new', 'this', 'typeof', 'instanceof', 'try', 'catch', 'finally'
  ];
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  escaped = escaped.replace(keywordRegex, '<span style="color: #ff7b72; font-weight: 500;">$1</span>');
  
  // Comments
  escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span style="color: #8b949e; font-style: italic;">$1</span>');
  escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #8b949e; font-style: italic;">$1</span>');
  
  // Strings
  escaped = escaped.replace(/("[^"]*")/g, '<span style="color: #a5d6ff;">$1</span>');
  escaped = escaped.replace(/('[^']*')/g, '<span style="color: #a5d6ff;">$1</span>');
  escaped = escaped.replace(/(`[^`]*`)/g, '<span style="color: #a5d6ff;">$1</span>');

  return <code style={{ fontFamily: 'var(--font-mono)' }} dangerouslySetInnerHTML={{ __html: escaped }} />;
}

function highlightGeneric(code) {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return <code style={{ fontFamily: 'var(--font-mono)' }}>{escaped}</code>;
}

function highlight(code, language) {
  const lang = language ? language.toLowerCase().trim() : '';
  if (lang === 'python' || lang === 'py') {
    return highlightPython(code);
  } else if (lang === 'sql') {
    return highlightSQL(code);
  } else if (lang === 'javascript' || lang === 'js' || lang === 'jsx' || lang === 'ts' || lang === 'tsx') {
    return highlightJS(code);
  } else {
    return highlightGeneric(code);
  }
}

// --- SUB-COMPONENTS ---

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="code-block-copy-button">
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy code
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre">
        {highlight(code, language)}
      </pre>
    </div>
  );
}

// Custom Markdown Inline Parser
function parseInline(text) {
  if (!text) return [];
  
  const boldIndex = text.indexOf('**');
  const codeIndex = text.indexOf('`');
  
  if (boldIndex === -1 && codeIndex === -1) {
    return [text];
  }
  
  // Decide which format tag appears first
  if (codeIndex !== -1 && (boldIndex === -1 || codeIndex < boldIndex)) {
    const before = text.substring(0, codeIndex);
    const afterCode = text.substring(codeIndex + 1);
    const nextCodeIndex = afterCode.indexOf('`');
    if (nextCodeIndex !== -1) {
      const codeText = afterCode.substring(0, nextCodeIndex);
      const remaining = afterCode.substring(nextCodeIndex + 1);
      return [
        ...parseInline(before),
        <code key={`code-${codeIndex}`} className="inline-code">{codeText}</code>,
        ...parseInline(remaining)
      ];
    }
  } else if (boldIndex !== -1) {
    const before = text.substring(0, boldIndex);
    const afterBold = text.substring(boldIndex + 2);
    const nextBoldIndex = afterBold.indexOf('**');
    if (nextBoldIndex !== -1) {
      const boldText = afterBold.substring(0, nextBoldIndex);
      const remaining = afterBold.substring(nextBoldIndex + 2);
      return [
        ...parseInline(before),
        <strong key={`bold-${boldIndex}`} className="markdown-strong">{parseInline(boldText)}</strong>,
        ...parseInline(remaining)
      ];
    }
  }
  
  return [text];
}

// Custom Markdown Block Parser
function renderMarkdownBlocks(text) {
  if (!text) return null;
  
  const lines = text.split('\n');
  const blocks = [];
  let currentBlock = null;
  
  const flushCurrentBlock = () => {
    if (!currentBlock) return;
    
    if (currentBlock.type === 'paragraph') {
      blocks.push(
        <p key={blocks.length} className="markdown-p">
          {parseInline(currentBlock.lines.join('\n'))}
        </p>
      );
    } else if (currentBlock.type === 'blockquote') {
      const cleanText = currentBlock.lines.map(line => line.replace(/^>\s?/, '')).join('\n');
      blocks.push(
        <div key={blocks.length} className="markdown-blockquote">
          {parseInline(cleanText)}
        </div>
      );
    } else if (currentBlock.type === 'bullet-list') {
      blocks.push(
        <ul key={blocks.length} className="markdown-ul">
          {currentBlock.items.map((item, idx) => (
            <li key={idx} className="markdown-li">{parseInline(item)}</li>
          ))}
        </ul>
      );
    } else if (currentBlock.type === 'numbered-list') {
      blocks.push(
        <ol key={blocks.length} className="markdown-ol">
          {currentBlock.items.map((item, idx) => (
            <li key={idx} className="markdown-li">{parseInline(item)}</li>
          ))}
        </ol>
      );
    }
    
    currentBlock = null;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed === '') {
      flushCurrentBlock();
      continue;
    }
    
    if (line.startsWith('>')) {
      if (currentBlock && currentBlock.type !== 'blockquote') {
        flushCurrentBlock();
      }
      if (!currentBlock) {
        currentBlock = { type: 'blockquote', lines: [] };
      }
      currentBlock.lines.push(line);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentBlock && currentBlock.type !== 'bullet-list') {
        flushCurrentBlock();
      }
      if (!currentBlock) {
        currentBlock = { type: 'bullet-list', items: [] };
      }
      currentBlock.items.push(trimmed.substring(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (currentBlock && currentBlock.type !== 'numbered-list') {
        flushCurrentBlock();
      }
      if (!currentBlock) {
        currentBlock = { type: 'numbered-list', items: [] };
      }
      const itemText = trimmed.replace(/^\d+\.\s/, '');
      currentBlock.items.push(itemText);
    } else {
      if (currentBlock && currentBlock.type !== 'paragraph') {
        flushCurrentBlock();
      }
      if (!currentBlock) {
        currentBlock = { type: 'paragraph', lines: [] };
      }
      currentBlock.lines.push(line);
    }
  }
  
  flushCurrentBlock();
  return blocks;
}

// Main message content renderer
function MessageContent({ content }) {
  const parts = content.split('```');
  
  return (
    <div className="assistant-body">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const firstNewLine = part.indexOf('\n');
          let language = 'code';
          let code = part;
          if (firstNewLine !== -1) {
            language = part.substring(0, firstNewLine).trim() || 'code';
            code = part.substring(firstNewLine + 1);
          }
          code = code.replace(/\n$/, '');
          return (
            <CodeBlock key={index} language={language} code={code} />
          );
        } else {
          return renderMarkdownBlocks(part);
        }
      })}
    </div>
  );
}

// Helper to parse the vulnerability report from the markdown text
function parseVulnReport(text) {
  if (!text) return null;
  
  // Look for the exact bold headers (case insensitive/trimmed match support)
  const matchedVulnIndex = text.indexOf('**Matched Vulnerability**');
  const categoryIndex = text.indexOf('**Category**');
  const severityIndex = text.indexOf('**Severity**');
  const remediationIndex = text.indexOf('**Remediation**');
  
  if (matchedVulnIndex === -1 || categoryIndex === -1 || severityIndex === -1 || remediationIndex === -1) {
    return null; // Not a structured report block
  }
  
  // Extract values between headers
  const matched_vulnerability = text.substring(matchedVulnIndex + '**Matched Vulnerability**'.length, categoryIndex).trim();
  const category = text.substring(categoryIndex + '**Category**'.length, severityIndex).trim();
  const severity = text.substring(severityIndex + '**Severity**'.length, remediationIndex).trim();
  const remediation = text.substring(remediationIndex + '**Remediation**'.length).trim();
  
  return {
    matched_vulnerability,
    category,
    severity,
    remediation
  };
}

// Helper to parse remediation into structured sections
function parseRemediation(text) {
  if (!text) return [];
  
  // Find indices of headings
  const immediateIndex = text.indexOf('IMMEDIATE ACTIONS:');
  const verificationIndex = text.indexOf('VERIFICATION:');
  const longTermIndex = text.indexOf('LONG-TERM MEASURES:');
  
  const sections = [];
  
  if (immediateIndex !== -1) {
    const end = verificationIndex !== -1 ? verificationIndex : (longTermIndex !== -1 ? longTermIndex : text.length);
    sections.push({
      title: 'IMMEDIATE ACTIONS',
      content: text.substring(immediateIndex + 'IMMEDIATE ACTIONS:'.length, end).trim()
    });
  }
  
  if (verificationIndex !== -1) {
    const end = longTermIndex !== -1 ? longTermIndex : text.length;
    sections.push({
      title: 'VERIFICATION',
      content: text.substring(verificationIndex + 'VERIFICATION:'.length, end).trim()
    });
  }
  
  if (longTermIndex !== -1) {
    sections.push({
      title: 'LONG-TERM MEASURES',
      content: text.substring(longTermIndex + 'LONG-TERM MEASURES:'.length).trim()
    });
  }
  
  // Fallback if none of the headings are found
  if (sections.length === 0) {
    sections.push({
      title: 'REMEDIATION',
      content: text
    });
  }
  
  return sections;
}

// React component to render a structured vulnerability analysis report card
function VulnReport({ data, onCopy }) {
  const [copied, setCopied] = useState(false);
  const { matched_vulnerability, category, severity, remediation } = data;
  
  const handleCopy = () => {
    // Format the remediation content using section headers
    const remediationSections = parseRemediation(remediation);
    const remediationFormatted = remediationSections
      .map(s => `${s.title}:\n${s.content}`)
      .join('\n\n');
    
    const textToCopy = [
      `Matched Vulnerability:`,
      matched_vulnerability,
      ``,
      `Category:`,
      category,
      ``,
      `Severity:`,
      severity,
      ``,
      `Remediation:`,
      remediationFormatted
    ].join('\n');
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  const remediationSections = parseRemediation(remediation);

  // Determine severity color/badge styling
  let severityClass = 'sev-info';
  if (severity) {
    const sevLower = severity.toLowerCase();
    if (sevLower.includes('critical')) severityClass = 'sev-critical';
    else if (sevLower.includes('high')) severityClass = 'sev-high';
    else if (sevLower.includes('medium')) severityClass = 'sev-medium';
    else if (sevLower.includes('low')) severityClass = 'sev-low';
  }

  return (
    <div className="vuln-report-card">

      
      <div className="vuln-report-grid">
        <div className="vuln-report-item full-width">
          <span className="vuln-report-label">Vulnerability</span>
          <span className="vuln-report-value bold-value">{matched_vulnerability}</span>
        </div>
        
        <div className="vuln-report-item">
          <span className="vuln-report-label">Category</span>
          <span className="vuln-report-value">{category}</span>
        </div>
        
        <div className="vuln-report-item">
          <span className="vuln-report-label">Severity</span>
          <span className={`vuln-report-value severity-badge ${severityClass}`}>{severity}</span>
        </div>
      </div>
      
      <div className="vuln-report-divider"></div>
      
      <div className="vuln-report-remediation">
        <span className="vuln-report-label" style={{ marginBottom: '12px' }}>Remediation</span>
        <div className="remediation-sections">
          {remediationSections.map((sec, idx) => (
            <div key={idx} className="remediation-section">
              <div className="remediation-title">{sec.title}</div>
              <div className="remediation-content">
                {renderMarkdownBlocks(sec.content)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="vuln-report-footer">
        <button onClick={handleCopy} className="copy-report-btn">
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// --- LOCALSTORAGE HELPERS ---

const STORAGE_KEY = 'sentrix_conversations';

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

// Generates a conversation title from the first user message (max 45 chars)
function generateTitle(text) {
  const clean = text.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 45 ? clean.substring(0, 42) + '...' : clean || 'New Conversation';
}

// --- MAIN APP COMPONENT ---
// (mock data block removed — replaced with real localStorage conversations)


// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Conversation history state (backed by localStorage) ────────────────────
  const [conversations, setConversations] = useState(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState(null);

  // ── Active messages derived from the active conversation ──────────────────
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const [messages, setMessages] = useState(activeConversation ? activeConversation.messages : []);

  // ── Other UI state ────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  
  // Mobile UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Settings modal states
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState('Sentrix AI (Default)');
  const [securityStandard, setSecurityStandard] = useState('OWASP Top 10 (2021)');
  const [enforceSafeCode, setEnforceSafeCode] = useState(true);
  
  // Theme and Collapsible Sidebar states
  const [theme, setTheme] = useState('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg) => {
    setToast(msg);
  };

  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Persist conversations to localStorage on every change ─────────────────
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // ── Auto-scroll to bottom of messages ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle textarea auto-resizing
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // ── Switch to an existing conversation ───────────────────────────────────
  const handleSelectHistoryItem = (id) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversationId(id);
      setMessages(conv.messages);
    }
    setIsSidebarOpen(false);
  };

  // ── Start a fresh conversation (clears active state → shows welcome screen)
  const handleNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
    setInputValue('');
    setAttachment(null);
    setIsSidebarOpen(false);
  };

  // ── Delete a conversation from sidebar ────────────────────────────────────
  const handleDeleteConversation = (e, id) => {
    e.stopPropagation(); // Don't trigger the select handler
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setMessages([]);
      setActiveConversationId(null);
    }
  };

  // Click file trigger
  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  // Read file details on upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        name: file.name,
        content: event.target.result,
        type: file.name.split('.').pop() || 'txt'
      });
    };
    reader.readAsText(file);
    e.target.value = null; // Clear file input
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  // Suggestion chips handler
  const handleSuggestionClick = (promptText) => {
    submitMessage(promptText);
  };

  // Form submit message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim() && !attachment) return;
    
    let userMsgText = inputValue;
    if (attachment) {
      // Determine file codeblock language
      let codeLang = attachment.type;
      if (codeLang === 'py') codeLang = 'python';
      if (codeLang === 'js') codeLang = 'javascript';
      if (codeLang === 'sql') codeLang = 'sql';
      
      const fileCodeBlock = `\n\n\`\`\`${codeLang}\n${attachment.content}\n\`\`\``;
      userMsgText = inputValue.trim() 
        ? `${inputValue.trim()}\n\nUploaded file: **${attachment.name}**${fileCodeBlock}`
        : `Attached file: **${attachment.name}**${fileCodeBlock}`;
    }
    
    submitMessage(userMsgText);
    setInputValue('');
    setAttachment(null);
  };

  const submitMessage = async (text) => {
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text
    };

    // ── Determine if this is the first message of a new conversation ──────
    const isNewConversation = activeConversationId === null;
    const newConversationId = isNewConversation ? `conv-${Date.now()}` : activeConversationId;

    // ── If starting a new conversation, create it immediately in the sidebar
    if (isNewConversation) {
      const newConv = {
        id: newConversationId,
        title: generateTitle(text),
        messages: [userMsg],
        updatedAt: Date.now()
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConversationId);
    } else {
      // Append user message to existing conversation
      setConversations(prev => prev.map(c =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
          : c
      ));
    }

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const json = await response.json();

      let aiResponseText = '';

      if (!response.ok || !json.success) {
        // Backend returned an error or no-match — show the message directly
        aiResponseText = json.message || 'An unexpected error occurred. Please try again.';
      } else {
        // Format the structured vulnerability result as readable markdown
        const { matched_vulnerability, category, severity, remediation } = json.data;
        aiResponseText = [
          `**Matched Vulnerability**`,
          matched_vulnerability,
          ``,
          `**Category**`,
          category,
          ``,
          `**Severity**`,
          severity,
          ``,
          `**Remediation**`,
          remediation
        ].join('\n');
      }

      const assistantMsg = { id: `msg-${Date.now()}`, role: 'assistant', content: aiResponseText };

      // Append assistant response to the conversation in state + localStorage
      setConversations(prev => prev.map(c =>
        c.id === newConversationId
          ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
          : c
      ));
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      const errorMsg = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to reach the Sentrix backend. Please ensure the server is running on port 5001 and try again.'
      };
      setConversations(prev => prev.map(c =>
        c.id === newConversationId
          ? { ...c, messages: [...c.messages, errorMsg], updatedAt: Date.now() }
          : c
      ));
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className={`app-container theme-${theme}`}>
      {/* CSS STYLESHEET */}
      <style>{`
        :root {
          --font-stack: Söhne, ui-sans-serif, system-ui, -apple-system, sans-serif;
          --font-mono: 'Söhne Mono', Monaco, 'Courier New', monospace;
          --color-primary: #10a37f;
          --color-primary-hover: #1a7f64;
          --color-code-bg: #1e1e1e;
        }

        /* Light Theme variables */
        .app-container.theme-light {
          --color-chat-bg: #ffffff;
          --color-text-main: #212121;
          --color-text-muted: #676767;
          --color-border: #e5e5e5;
          --color-input-bg: #ffffff;
          --color-input-border: #e5e5e5;
          --color-bubble-user: #2f2f2f;
          --color-bubble-user-text: #ffffff;
          --color-assistant-name: #0d0d0d;
          --color-blockquote-bg: #f9f9f9;
          --color-blockquote-text: #24292f;
          --color-inline-code-bg: #f4f4f4;
          --color-inline-code-text: #171717;
          
          --color-sidebar-bg: #171717;
          --color-sidebar-text: #ececec;
          --color-sidebar-hover: #2a2a2a;
          --color-sidebar-active: #2f2f2f;
          --color-sidebar-divider: #2f2f2f;
          --color-new-chat-bg: #ffffff14;
          --color-new-chat-border: transparent;
          --color-new-chat-text: #ffffff;
          --color-new-chat-hover: #ffffff20;
          --color-sidebar-footer-border: #2f2f2f;
          --color-sidebar-avatar-bg: #4a4a4a;
          --color-sidebar-avatar-text: #ffffff;
          --color-sidebar-avatar-border: transparent;
          --color-settings-trigger: #b4b4b4;
          --color-settings-trigger-hover: #ffffff;
          --color-sidebar-toggle-btn: #b4b4b4;
          --color-sidebar-toggle-btn-hover: #ffffff;
          
          --color-modal-bg: #ffffff;
          --color-modal-select-bg: #ffffff;
          --color-modal-close-hover: #f4f4f4;
        }

        /* Dark Theme variables */
        .app-container.theme-dark {
          --color-chat-bg: #212121;
          --color-text-main: #ececec;
          --color-text-muted: #b4b4b4;
          --color-border: #2f2f2f;
          --color-input-bg: #2f2f2f;
          --color-input-border: #2f2f2f;
          --color-bubble-user: #2f2f2f;
          --color-bubble-user-text: #ffffff;
          --color-assistant-name: #ffffff;
          --color-blockquote-bg: #2f2f2f;
          --color-blockquote-text: #ececec;
          --color-inline-code-bg: #2f2f2f;
          --color-inline-code-text: #ececec;
          
          --color-sidebar-bg: #171717;
          --color-sidebar-text: #ececec;
          --color-sidebar-hover: #2a2a2a;
          --color-sidebar-active: #2f2f2f;
          --color-sidebar-divider: #2f2f2f;
          --color-new-chat-bg: #ffffff14;
          --color-new-chat-border: transparent;
          --color-new-chat-text: #ffffff;
          --color-new-chat-hover: #ffffff20;
          --color-sidebar-footer-border: #2f2f2f;
          --color-sidebar-avatar-bg: #4a4a4a;
          --color-sidebar-avatar-text: #ffffff;
          --color-sidebar-avatar-border: transparent;
          --color-settings-trigger: #b4b4b4;
          --color-settings-trigger-hover: #ffffff;
          --color-sidebar-toggle-btn: #b4b4b4;
          --color-sidebar-toggle-btn-hover: #ffffff;
          
          --color-modal-bg: #2f2f2f;
          --color-modal-select-bg: #212121;
          --color-modal-close-hover: #3a3a3a;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--font-stack);
          background-color: var(--color-chat-bg);
          color: var(--color-text-main);
          overflow: hidden;
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #e5e5e5;
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ccc;
        }

        .app-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: relative;
          background-color: var(--color-chat-bg);
          color: var(--color-text-main);
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Sidebar */
        .sidebar {
          width: 260px;
          background-color: var(--color-sidebar-bg);
          color: var(--color-sidebar-text);
          display: flex;
          flex-direction: column;
          height: 100%;
          flex-shrink: 0;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
          position: relative;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 16px;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-sidebar-text);
        }

        /* Sidebar Collapse Styles */
        @media (min-width: 769px) {
          .sidebar.collapsed {
            margin-left: -260px;
          }
          .sidebar-toggle-btn {
            background: none;
            border: none;
            color: var(--color-sidebar-toggle-btn);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s, color 0.2s;
            margin-left: auto;
          }
          .sidebar-toggle-btn:hover {
            background-color: var(--color-sidebar-hover);
            color: var(--color-sidebar-toggle-btn-hover);
          }
          .main-sidebar-toggle-btn {
            position: absolute;
            top: 16px;
            left: 16px;
            z-index: 90;
            background-color: var(--color-chat-bg);
            border: 1px solid var(--color-border);
            color: var(--color-text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
          }
          .main-sidebar-toggle-btn:hover {
            color: var(--color-text-main);
            background-color: var(--color-border);
            transform: scale(1.05);
          }
        }
        @media (max-width: 768px) {
          .sidebar-toggle-btn {
            display: none;
          }
          .main-sidebar-toggle-btn {
            display: none;
          }
        }

        .new-chat-btn {
          margin: 4px 12px;
          padding: 10px 14px;
          background-color: var(--color-new-chat-bg);
          border: var(--color-new-chat-border);
          border-radius: 8px;
          color: var(--color-new-chat-text);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }

        .new-chat-btn:hover {
          background-color: var(--color-new-chat-hover);
        }

        .sidebar-divider {
          height: 1px;
          background-color: var(--color-sidebar-divider);
          margin: 12px 12px;
        }

        .sidebar-history-container {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .history-item {
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--color-sidebar-text);
          transition: background-color 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .history-item:hover {
          background-color: var(--color-sidebar-hover);
        }

        .history-item:hover .conv-delete-btn {
          opacity: 1 !important;
        }

        .history-item.active {
          background-color: var(--color-sidebar-active);
          color: #ffffff;
        }

        .history-item.active .conv-delete-btn {
          opacity: 0.6 !important;
        }

        .history-item.active .conv-delete-btn:hover {
          opacity: 1 !important;
        }

        .sidebar-footer {
          padding: 16px 12px;
          border-top: 1px solid var(--color-sidebar-footer-border);
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: auto;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--color-sidebar-avatar-bg);
          color: var(--color-sidebar-avatar-text);
          border: var(--color-sidebar-avatar-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .user-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-sidebar-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 12px;
          color: #8e8e93;
        }

        .settings-trigger {
          background: none;
          border: none;
          color: var(--color-settings-trigger);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .settings-trigger:hover {
          background-color: var(--color-sidebar-hover);
          color: var(--color-settings-trigger-hover);
        }

        /* Main Chat Content */
        .main-content {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          height: 100%;
          min-width: 0;
          position: relative;
          background-color: var(--color-chat-bg);
        }

        /* Mobile Top Navigation */
        .mobile-header {
          display: none;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          border-bottom: 1px solid var(--color-border);
          background-color: var(--color-chat-bg);
          height: 56px;
          flex-shrink: 0;
          width: 100%;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        .menu-btn {
          background: none;
          border: none;
          color: var(--color-text-main);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: color 0.3s ease;
        }

        .menu-btn:hover {
          background-color: var(--color-border);
        }

        .mobile-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-main);
        }

        /* Chat Thread container */
        .chat-area {
          flex-grow: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          width: 100%;
          position: relative;
        }

        .chat-messages-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
          width: 100%;
          max-width: 720px;
          padding: 40px 20px 180px 20px;
          box-sizing: border-box;
        }

        /* Message structure */
        .message-row {
          display: flex;
          flex-direction: column;
          margin-bottom: 36px;
          width: 100%;
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-row.user {
          align-items: flex-end;
        }

        .message-row.assistant {
          align-items: flex-start;
        }

        .user-bubble {
          background-color: var(--color-bubble-user);
          color: var(--color-bubble-user-text);
          padding: 12px 18px;
          border-radius: 18px;
          max-width: 75%;
          word-break: break-word;
          font-size: 15px;
          line-height: 1.5;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .assistant-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .assistant-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          flex-shrink: 0;
          transition: background-color 0.3s ease;
        }

        .assistant-name {
          font-weight: 600;
          color: var(--color-assistant-name);
          font-size: 14px;
          transition: color 0.3s ease;
        }

        .assistant-body {
          width: 100%;
          color: var(--color-text-main);
          font-size: 15px;
          line-height: 1.75;
        }

        /* Bottom sticky bar */
        .input-container-sticky {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(180deg, transparent 0%, var(--color-chat-bg) 70%);
          padding: 0 20px 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
          z-index: 10;
          transition: background 0.3s ease;
        }

        .input-wrapper {
          width: 100%;
          max-width: 760px;
          background-color: var(--color-input-bg);
          border: 1px solid var(--color-input-border);
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 8px 12px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          position: relative;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.3s ease;
        }

        .input-wrapper:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 4px 24px rgba(16, 163, 127, 0.1);
        }

        .input-row {
          display: flex;
          align-items: flex-end;
          width: 100%;
        }

        .chat-textarea {
          flex-grow: 1;
          border: none;
          resize: none;
          background: transparent;
          outline: none;
          padding: 8px 8px;
          color: var(--color-text-main);
          font-family: var(--font-stack);
          font-size: 15px;
          max-height: 140px;
          min-height: 24px;
          line-height: 1.5;
          overflow-y: auto;
        }

        .paperclip-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #8e8e93;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          transition: background-color 0.2s, color 0.2s;
          flex-shrink: 0;
          margin-bottom: 2px;
        }

        .paperclip-btn:hover {
          background-color: var(--color-border);
          color: var(--color-text-main);
        }

        .send-btn {
          background-color: #3a3a3a;
          color: #ffffff;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: not-allowed;
          transition: background-color 0.2s, transform 0.1s;
          flex-shrink: 0;
          margin-bottom: 4px;
          margin-left: 8px;
        }

        .send-btn.active {
          background-color: var(--color-primary);
          cursor: pointer;
        }

        .send-btn.active:hover {
          background-color: var(--color-primary-hover);
        }

        .send-btn:active {
          transform: scale(0.95);
        }

        .footer-text {
          font-size: 12px;
          color: var(--color-text-muted);
          text-align: center;
          margin-top: 12px;
          pointer-events: auto;
        }

        /* Welcome Screen */
        .welcome-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex-grow: 1;
          padding: 40px 20px 180px 20px;
          box-sizing: border-box;
          max-width: 680px;
          margin: auto;
          width: 100%;
        }

        .welcome-logo {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          margin-bottom: 24px;
          transition: background-color 0.3s ease;
        }

        .welcome-heading {
          font-size: 26px;
          font-weight: 600;
          color: var(--color-text-main);
          margin-top: 0;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .welcome-subtext {
          color: var(--color-text-muted);
          font-size: 15px;
          margin-bottom: 32px;
          max-width: 460px;
          line-height: 1.6;
        }

        .suggestion-chips {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }

        .suggestion-chip {
          background-color: var(--color-input-bg);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-main);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .suggestion-chip:hover {
          background-color: var(--color-border);
          border-color: var(--color-text-muted);
          transform: translateY(-1px);
        }

        /* Attachment Badge */
        .attachment-badge {
          display: flex;
          align-items: center;
          background-color: var(--color-border);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 6px 10px;
          margin-bottom: 8px;
          width: fit-content;
          max-width: 100%;
          margin-left: 8px;
          animation: slideIn 0.2s ease;
          transition: background-color 0.3s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .attachment-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-main);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 180px;
          margin-right: 8px;
        }

        .attachment-remove-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #8e8e93;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: color 0.2s;
        }

        .attachment-remove-btn:hover {
          color: #ef4444;
        }

        /* Code Block / Markdowns */
        .code-block-container {
          margin: 16px 0;
          border-radius: 8px;
          overflow: hidden;
          background-color: var(--color-code-bg);
          border: 1px solid #2f2f2f;
          width: 100%;
        }

        .code-block-header {
          background-color: #2f2f2f;
          color: #b4b4b4;
          padding: 8px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-family: var(--font-stack);
        }

        .code-block-copy-button {
          background: none;
          border: none;
          color: #b4b4b4;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.2s;
          font-size: 12px;
        }

        .code-block-copy-button:hover {
          color: #ffffff;
        }

        .code-block-pre {
          margin: 0;
          padding: 16px;
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 13.5px;
          line-height: 1.5;
          color: #e3e3e3;
          background-color: var(--color-code-bg);
        }

        .inline-code {
          font-family: var(--font-mono);
          background-color: var(--color-inline-code-bg);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.9em;
          font-weight: 500;
          color: var(--color-inline-code-text);
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .markdown-p {
          margin-top: 0;
          margin-bottom: 16px;
          line-height: 1.75;
        }

        .markdown-ul {
          margin-top: 0;
          margin-bottom: 16px;
          padding-left: 24px;
          list-style-type: disc;
        }

        .markdown-ol {
          margin-top: 0;
          margin-bottom: 16px;
          padding-left: 24px;
          list-style-type: decimal;
        }

        .markdown-li {
          margin-bottom: 8px;
        }

        .markdown-blockquote {
          border-left: 4px solid var(--color-primary);
          padding: 12px 16px;
          margin: 20px 0;
          color: var(--color-blockquote-text);
          background-color: var(--color-blockquote-bg);
          border-radius: 0 8px 8px 0;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .markdown-strong {
          font-weight: 600;
          color: var(--color-text-main);
        }

        .chat-textarea::placeholder {
          color: var(--color-text-muted);
          opacity: 0.7;
        }

        /* Toast Message Notification */
        .toast-message {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--color-bubble-user);
          color: var(--color-bubble-user-text);
          padding: 10px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: toastFadeInOut 2s ease-in-out;
        }

        @keyframes toastFadeInOut {
          0% { opacity: 0; transform: translate(-50%, 10px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          90% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -10px); }
        }

        /* Vulnerability Analysis Report Card styling */
        .vuln-report-card {
          background-color: var(--color-input-bg);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 20px;
          margin: 16px 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          transition: all 0.3s ease;
          width: 100%;
        }

        .vuln-report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .vuln-report-badge {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 4px;
          background-color: var(--color-border);
          color: var(--color-text-muted);
        }

        .vuln-report-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        .vuln-report-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .vuln-report-item.full-width {
          grid-column: span 2;
        }

        .vuln-report-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .vuln-report-value {
          font-size: 15px;
          color: var(--color-text-main);
          font-weight: 500;
        }

        .vuln-report-value.bold-value {
          font-family: var(--font-mono);
          font-weight: 600;
          word-break: break-all;
        }

        .severity-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          width: fit-content;
        }

        .sev-critical {
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .sev-high {
          background-color: rgba(249, 115, 22, 0.1);
          color: #f97316;
        }

        .sev-medium {
          background-color: rgba(234, 179, 8, 0.1);
          color: #eab308;
        }

        .sev-low {
          background-color: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .sev-info {
          background-color: rgba(107, 114, 128, 0.1);
          color: #6b7280;
        }

        .vuln-report-divider {
          height: 1px;
          background-color: var(--color-border);
          margin: 16px 0;
        }

        .vuln-report-remediation {
          display: flex;
          flex-direction: column;
        }

        .remediation-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .remediation-section {
          background-color: rgba(0, 0, 0, 0.015);
          border-left: 3px solid var(--color-primary);
          padding: 12px 16px;
          border-radius: 0 8px 8px 0;
        }

        .app-container.theme-dark .remediation-section {
          background-color: rgba(255, 255, 255, 0.02);
        }

        .remediation-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-main);
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }

        .remediation-content {
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--color-text-main);
        }

        .remediation-content p {
          margin-bottom: 8px;
        }

        .remediation-content p:last-child {
          margin-bottom: 0;
        }

        .vuln-report-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .copy-report-btn {
          background: none;
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 8px 14px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .copy-report-btn:hover {
          background-color: var(--color-border);
          color: var(--color-text-main);
        }

        @media (max-width: 500px) {
          .vuln-report-grid {
            grid-template-columns: 1fr;
          }
          .vuln-report-item.full-width {
            grid-column: span 1;
          }
        }

        /* Typing Animation */
        .typing-indicator-container {
          display: flex;
          align-items: center;
          padding: 8px 0;
        }

        .dot {
          width: 6px;
          height: 6px;
          background-color: #676767;
          border-radius: 50%;
          margin: 0 3px;
          display: inline-block;
          animation: pulse 1.4s infinite both;
        }

        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        /* Modal Overlay & Dialog */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeInBg 0.2s ease-out;
        }

        @keyframes fadeInBg {
          from { background-color: rgba(0, 0, 0, 0); }
          to { background-color: rgba(0, 0, 0, 0.4); }
        }

        .modal-content {
          background-color: var(--color-modal-bg);
          color: var(--color-text-main);
          border-radius: 12px;
          padding: 24px;
          width: 90%;
          max-width: 440px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          position: relative;
          animation: modalScale 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes modalScale {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-main);
        }

        .modal-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-muted);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close-btn:hover {
          background-color: var(--color-modal-close-hover);
          color: var(--color-text-main);
        }

        .setting-group {
          margin-bottom: 20px;
        }

        .setting-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-main);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .setting-select {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background-color: var(--color-modal-select-bg);
          color: var(--color-text-main);
          font-family: inherit;
          font-size: 14px;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23676767' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          cursor: pointer;
        }

        .setting-select:focus {
          border-color: var(--color-primary);
        }

        .setting-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--color-border);
          transition: .4s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: var(--color-primary);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        /* Mobile Responsive Logic */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            width: 280px;
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.4);
            z-index: 99;
            animation: fadeInBg 0.2s ease-out;
          }

          .mobile-header {
            display: flex;
          }

          .chat-messages-container {
            padding-top: 20px;
          }
        }
      `}</style>

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10a37f' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Sentrix</span>
          </div>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarCollapsed(true)} title="Collapse sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Chat</span>
        </button>

        <div className="sidebar-divider"></div>

        <div className="sidebar-history-container">
          {conversations.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No conversations yet
            </div>
          ) : (
            conversations
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((conv) => (
                <div
                  key={conv.id}
                  className={`history-item ${activeConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => handleSelectHistoryItem(conv.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8e8e93', flexShrink: 0 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    title="Delete conversation"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                      color: 'var(--color-text-muted)', padding: '2px 4px', borderRadius: '4px',
                      fontSize: '14px', lineHeight: 1, opacity: 0,
                      transition: 'opacity 0.15s'
                    }}
                    className="conv-delete-btn"
                  >
                    ✕
                  </button>
                </div>
              ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar">SA</div>
          <div className="user-info">
            <span className="user-name">Security Analyst</span>
            <span className="user-role">SA Enterprise</span>
          </div>
          <button 
            className="settings-trigger" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{ marginRight: '4px' }}
          >
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
          <button className="settings-trigger" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        {/* Desktop Sidebar Toggle Button (Floating) */}
        {isSidebarCollapsed && (
          <button className="main-sidebar-toggle-btn" onClick={() => setIsSidebarCollapsed(false)} title="Show sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
        )}
        {/* Mobile Header Navigation */}
        <header className="mobile-header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="mobile-title">Sentrix</div>
          <button className="menu-btn" onClick={handleNewChat}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </header>

        {/* Scrollable messages or welcome screen */}
        <div className="chat-area">
          {messages.length === 0 ? (
            /* WELCOME SCREEN */
            <div className="welcome-container">
              <div className="welcome-logo">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h1 className="welcome-heading">How can I help you today?</h1>
              <p className="welcome-subtext">
                Ask me anything about cybersecurity, OWASP vulnerabilities, or paste code to scan.
              </p>
              <div className="suggestion-chips">
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Explain SQL Injection")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10a37f' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  Explain SQL Injection
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("What is OWASP Top 10?")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10a37f' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  What is OWASP Top 10?
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Scan my code for XSS")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10a37f' }}>
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                  </svg>
                  Scan my code for XSS
                </button>
              </div>
            </div>
          ) : (
            /* MESSAGES THREAD */
            <div className="chat-messages-container">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  {msg.role === 'assistant' ? (
                    <>
                      {(() => {
                        const parsedReport = parseVulnReport(msg.content);
                        if (parsedReport) {
                          return <VulnReport data={parsedReport} onCopy={() => showToast('Analysis report copied to clipboard!')} />;
                        }
                        return (
                          <>
                            <div className="assistant-header">
                              <div className="assistant-avatar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                              </div>
                              <span className="assistant-name">Sentrix</span>
                            </div>
                            <MessageContent content={msg.content} />
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="user-bubble">
                      {msg.content.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < msg.content.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* TYPING DOTS FOR AI */}
              {isLoading && (
                <div className="message-row assistant">
                  <div className="typing-indicator-container">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* BOTTOM INPUT BAR */}
        <div className="input-container-sticky">
          <div className="input-wrapper">
            {attachment && (
              <div className="attachment-badge">
                <span className="attachment-name" title={attachment.name}>
                  📎 {attachment.name}
                </span>
                <button className="attachment-remove-btn" onClick={handleRemoveAttachment}>
                  &times;
                </button>
              </div>
            )}
            <div className="input-row">
              <button
                className="paperclip-btn"
                onClick={handlePaperclipClick}
                title="Attach file/code block"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                rows="1"
                placeholder="Ask anything about cybersecurity, or paste code to scan..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className={`send-btn ${(inputValue.trim() || attachment) ? 'active' : ''}`}
                onClick={handleSubmit}
                disabled={!inputValue.trim() && !attachment}
                title="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>
          </div>
          <span className="footer-text">
            Sentrix &middot; Powered by OWASP Top 10 (2021)
          </span>
        </div>
      </div>

      {/* INVISIBLE FILE INPUT */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Settings</h2>
              <button className="modal-close-btn" onClick={() => setShowSettings(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="setting-group">
              <label className="setting-label">AI Scanning Engine</label>
              <select
                className="setting-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="Sentrix AI (Default)">Sentrix AI v1.2 (Default)</option>
                <option value="Sentrix v2.0-Alpha">Sentrix v2.0-Alpha (CWE Optimized)</option>
                <option value="GPT-4 Security-Tuned">GPT-4 Security-Tuned</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Policy Framework</label>
              <select
                className="setting-select"
                value={securityStandard}
                onChange={(e) => setSecurityStandard(e.target.value)}
              >
                <option value="OWASP Top 10 (2021)">OWASP Top 10 (2021)</option>
                <option value="OWASP Top 10 (2017)">OWASP Top 10 (2017)</option>
                <option value="CWE Top 25 (2023)">CWE Top 25 (2023)</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Appearance (Theme)</label>
              <select
                className="setting-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <div className="setting-group setting-toggle-row">
              <div>
                <label className="setting-label" style={{ marginBottom: '4px', textTransform: 'none', fontSize: '14px', fontWeight: '500' }}>
                  Enforce Safe Code Fixes
                </label>
                <span style={{ fontSize: '12px', color: '#676767' }}>
                  Automatically generate refactored code templates in replies
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={enforceSafeCode}
                  onChange={(e) => setEnforceSafeCode(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast-message">
          {toast}
        </div>
      )}
    </div>
  );
}
