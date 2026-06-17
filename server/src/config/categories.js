/**
 * Enterprise Security Category Taxonomy
 *
 * Single source of truth for all business categories and subcategories
 * used in GPT-driven vulnerability classification.
 *
 * CATEGORIES is the flat list of top-level category names sent to GPT Phase 2.
 * SUBCATEGORIES is the map used in the prompt to enumerate valid subcategory
 * options per category.
 *
 * To add a new category: add it to CATEGORIES and add a matching key in SUBCATEGORIES.
 */

export const CATEGORIES = [
  'Authentication Issues',
  'Authorization & Access Control',
  'Configuration & Hardening Issues',
  'Input Handling & Injection',
  'Data Protection',
  'Network & Communication Security',
  'Monitoring, Logging & Availability',
  'Architecture & Design Flaws'
];

export const SUBCATEGORIES = {
  'Authentication Issues': [
    'Weak Passwords',
    'Broken Authentication',
    'Missing MFA',
    'Default Credentials',
    'Credential Stuffing Exposure'
  ],
  'Authorization & Access Control': [
    'Privilege Escalation',
    'IDOR / BOLA',
    'Over-Permissive IAM Roles',
    'Missing Access Checks',
    'Horizontal Access Bypass',
    'Vertical Access Bypass'
  ],
  'Configuration & Hardening Issues': [
    'Default Settings',
    'Open Ports / Services',
    'Misconfigured Cloud Resources',
    'Debug Modes Enabled',
    'Weak Firewall Rules',
    'Vulnerable Dependencies & Outdated Libraries',
    'Client-Side Hardening & Deprecated APIs'
  ],
  'Input Handling & Injection': [
    'SQL Injection',
    'Command Injection',
    'Cross-Site Scripting (XSS)',
    'SSRF',
    'Deserialization Attacks'
  ],
  'Data Protection': [
    'Sensitive Data Exposure',
    'Weak or No Encryption',
    'Poor Key Management',
    'Hardcoded Secrets',
    'Insecure Storage',
    'Insecure Transmission'
  ],
  'Network & Communication Security': [
    'Insecure Protocols',
    'Weak TLS Configurations',
    'MITM Risks',
    'DNS Issues',
    'Lack of Network Segmentation'
  ],
  'Monitoring, Logging & Availability': [
    'Missing Logs / Auditing',
    'No Alerting / Monitoring',
    'DDoS Susceptibility',
    'Lack of Rate Limiting',
    'Incident Response Gaps'
  ],
  'Architecture & Design Flaws': [
    'System Architecture Review Issues',
    'Network Architecture Flaws',
    'Application Risk Framework Gaps',
    'VDI / Virtualization Design Weaknesses'
  ]
};

export default CATEGORIES;
