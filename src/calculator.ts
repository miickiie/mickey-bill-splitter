export type Operator = '+' | '-' | '×' | '÷';

const OPERATORS = new Set<string>(['+', '-', '×', '*', '÷', '/']);

export const normalizeOperator = (op: string): Operator => {
  if (op === '*' || op === '×') return '×';
  if (op === '/' || op === '÷') return '÷';
  if (op === '-') return '-';
  return '+';
};

export function tokenizeExpression(expr: string): (number | Operator)[] {
  const tokens: (number | Operator)[] = [];
  let currentNum = '';

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (OPERATORS.has(char)) {
      if (currentNum.length > 0) {
        const parsed = Number.parseFloat(currentNum);
        if (!Number.isNaN(parsed)) {
          tokens.push(parsed);
        }
        currentNum = '';
      }
      tokens.push(normalizeOperator(char));
    } else if (char >= '0' && char <= '9' || char === '.') {
      currentNum += char;
    }
  }

  if (currentNum.length > 0) {
    const parsed = Number.parseFloat(currentNum);
    if (!Number.isNaN(parsed)) {
      tokens.push(parsed);
    }
  }

  return tokens;
}

export function evaluateExpression(expr: string): number {
  if (!expr || expr.trim() === '') return 0;

  let tokens = tokenizeExpression(expr);
  if (tokens.length === 0) return 0;

  // If ends with an operator, discard trailing operator for evaluation
  while (tokens.length > 0 && typeof tokens[tokens.length - 1] === 'string') {
    tokens.pop();
  }

  if (tokens.length === 0) return 0;

  // If first token is an operator, handle unary or discard
  if (typeof tokens[0] === 'string') {
    if (tokens[0] === '-' && tokens.length > 1 && typeof tokens[1] === 'number') {
      tokens = [-tokens[1] as number, ...tokens.slice(2)];
    } else {
      tokens = tokens.slice(1);
    }
  }

  if (tokens.length === 0) return 0;

  // First pass: multiplication and division
  const pass1: (number | Operator)[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === '×' || token === '÷') {
      const prev = pass1.pop();
      const next = tokens[i + 1];
      if (typeof prev === 'number' && typeof next === 'number') {
        let res = 0;
        if (token === '×') {
          res = prev * next;
        } else {
          res = next !== 0 ? prev / next : 0;
        }
        pass1.push(res);
        i += 2;
        continue;
      }
    }
    pass1.push(token);
    i++;
  }

  // Second pass: addition and subtraction
  let result = typeof pass1[0] === 'number' ? pass1[0] : 0;
  let j = 1;
  while (j < pass1.length) {
    const op = pass1[j];
    const next = pass1[j + 1];
    if (typeof next === 'number') {
      if (op === '+') {
        result += next;
      } else if (op === '-') {
        result -= next;
      }
    }
    j += 2;
  }

  if (!Number.isFinite(result)) return 0;
  return Math.max(0, Math.round(result * 100) / 100);
}

export function appendKeyToExpression(current: string, key: string): string {
  const isOp = OPERATORS.has(key);
  const trimmed = current.trim();

  if (isOp) {
    const norm = normalizeOperator(key);
    if (!trimmed || trimmed === '0') {
      return `0 ${norm} `;
    }
    // Check if ends with operator
    const lastChar = trimmed[trimmed.length - 1];
    if (OPERATORS.has(lastChar)) {
      // Replace last operator
      const base = trimmed.slice(0, -1).trim();
      return `${base} ${norm} `;
    }
    return `${trimmed} ${norm} `;
  }

  if (key === '.') {
    if (!trimmed || trimmed === '0') {
      return '0.';
    }
    // Check if current number segment already has decimal
    const parts = trimmed.split(/[\+\-\×\*\÷\/]/);
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.includes('.')) {
      return current; // Do nothing, already has decimal
    }
    if (lastPart === '') {
      return `${current}0.`;
    }
    return `${current}.`;
  }

  // Digits 0-9
  if (trimmed === '0') {
    return key;
  }

  const parts = trimmed.split(/[\+\-\×\*\÷\/]/);
  const lastPart = parts[parts.length - 1].trim();
  if (lastPart === '0') {
    if (key === '0') return current;
    if (/^[1-9]$/.test(key)) {
      return `${current.slice(0, -1)}${key}`;
    }
  }

  return `${current}${key}`;
}

export function backspaceExpression(current: string): string {
  const trimmed = current.trim();
  if (trimmed.length <= 1) return '0';

  // If ends with an operator (with or without space), remove the operator and preceding space
  const lastChar = trimmed[trimmed.length - 1];
  if (OPERATORS.has(lastChar)) {
    const withoutOp = trimmed.slice(0, -1).trimEnd();
    return withoutOp === '' ? '0' : withoutOp;
  }

  // Otherwise, remove the last character
  const next = current.slice(0, -1);
  return next.trim() === '' ? '0' : next;
}
