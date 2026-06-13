/**
 * Business Category Registry
 *
 * Single source of truth for all business categories used in
 * GPT-driven vulnerability classification.
 *
 * To add a new category: append it to this array.
 * The classification prompt will automatically include it —
 * no other files need to change.
 */
const CATEGORIES = [
  'Software Upgrade',
  'Application Related',
  'Browser Related',
  'TLS-SSL Related',
  'Configuration Related',
  'Patching Related'
];

export default CATEGORIES;
