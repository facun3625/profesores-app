/**
 * Conversión liviana de LaTeX a Unicode para fórmulas escritas entre $...$ o \( ... \).
 *
 * El texto se guarda tal cual lo escribe el docente (con LaTeX) y se convierte al
 * mostrarlo/imprimirlo, así se ve igual en PDF, Word, pantalla y examen online
 * usando las fuentes Unicode que ya incluimos.
 *
 * Cubre lo habitual en secundaria/universidad: potencias e índices, fracciones,
 * raíces, letras griegas, operadores, conjuntos, flechas, \mathbb, \text.
 * No es un motor de composición completo (matrices, fracciones apiladas, etc.).
 *
 * ⚠️ Hay una copia idéntica en apps/web/src/lib/latex.ts: mantener sincronizadas.
 */

const SYMBOLS: Record<string, string> = {
  // Griegas
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ',
  Psi: 'Ψ', Omega: 'Ω',
  // Relaciones y operadores
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼',
  cong: '≅', propto: '∝', times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗',
  infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫', iint: '∬', oint: '∮',
  // Conjuntos y lógica
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃',
  neg: '¬', lnot: '¬', wedge: '∧', land: '∧', vee: '∨', lor: '∨',
  // Flechas
  rightarrow: '→', to: '→', leftarrow: '←', gets: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⇒', iff: '⇔', mapsto: '↦', uparrow: '↑',
  downarrow: '↓',
  // Geometría y varios
  degree: '°', circ: '∘', angle: '∠', perp: '⊥', parallel: '∥', triangle: '△', ldots: '…',
  cdots: '⋯', dots: '…', prime: '′', therefore: '∴', because: '∵', hbar: 'ℏ', ell: 'ℓ',
  // Funciones (texto)
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc', arcsin: 'arcsin',
  arccos: 'arccos', arctan: 'arctan', log: 'log', ln: 'ln', lim: 'lim', exp: 'exp', max: 'max',
  min: 'min', det: 'det', gcd: 'mcd',
  // Espacios y escapes
  quad: '  ', qquad: '    ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ',
  '{': '{', '}': '}', '$': '$', '%': '%', '&': '&', '#': '#', _: '_',
  left: '', right: '', big: '', Big: '', displaystyle: '',
};

const BLACKBOARD: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ' };

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ',
  e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ',
  p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', T: 'ᵀ',
  '∘': '°', '°': '°', '′': '′', '*': '*',
};

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ',
  j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ',
  v: 'ᵥ', x: 'ₓ',
};

const TEXT_COMMANDS = new Set(['text', 'mathrm', 'textrm', 'mathbf', 'textbf', 'mathit', 'textit', 'operatorname', 'mbox']);

class Parser {
  private i = 0;
  constructor(private readonly s: string) { }

  parse(stopAt?: string): string {
    let out = '';
    while (this.i < this.s.length) {
      const ch = this.s[this.i];
      if (stopAt && ch === stopAt) break;
      if (ch === '\\') out += this.command();
      else if (ch === '{') out += this.group();
      else if (ch === '^' || ch === '_') {
        this.i++;
        out += script(this.argument(), ch === '^' ? SUP : SUB, ch);
      } else if (ch === '}') {
        this.i++; // llave suelta: se ignora
      } else {
        out += ch === '-' ? '−' : ch;
        this.i++;
      }
    }
    return out;
  }

  /** Lee {grupo} o un solo token (letra, número o comando). */
  private argument(): string {
    while (this.s[this.i] === ' ') this.i++;
    const ch = this.s[this.i];
    if (ch === undefined) return '';
    if (ch === '{') return this.group();
    if (ch === '\\') return this.command();
    this.i++;
    return ch;
  }

  private group(): string {
    this.i++; // {
    const inner = this.parse('}');
    this.i++; // }
    return inner;
  }

  private rawGroup(): string {
    // contenido literal (para \text{...})
    while (this.s[this.i] === ' ') this.i++;
    if (this.s[this.i] !== '{') return this.argument();
    let depth = 0;
    const start = this.i + 1;
    for (; this.i < this.s.length; this.i++) {
      if (this.s[this.i] === '{') depth++;
      else if (this.s[this.i] === '}' && --depth === 0) break;
    }
    const text = this.s.slice(start, this.i);
    this.i++;
    return text;
  }

  private command(): string {
    this.i++; // backslash
    const m = /^[A-Za-z]+/.exec(this.s.slice(this.i));
    const name = m ? m[0] : this.s[this.i] ?? '';
    this.i += Math.max(1, name.length);

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const num = this.argument();
      const den = this.argument();
      return `${wrap(num)}/${wrap(den)}`;
    }
    if (name === 'sqrt') {
      let index = '';
      if (this.s[this.i] === '[') {
        this.i++;
        index = this.parse(']');
        this.i++;
      }
      const radicand = this.argument();
      const root = index === '3' ? '∛' : index === '4' ? '∜' : index ? `${script(index, SUP, '^')}√` : '√';
      return `${root}${wrap(radicand)}`;
    }
    if (name === 'mathbb') {
      const arg = this.argument();
      return BLACKBOARD[arg] ?? arg;
    }
    if (TEXT_COMMANDS.has(name)) return this.rawGroup();
    if (name === 'overline' || name === 'bar') return `${this.argument()}̅`;
    if (name === 'vec') return `${this.argument()}⃗`;
    if (name === 'hat') return `${this.argument()}̂`;
    if (name in SYMBOLS) {
      const out = SYMBOLS[name];
      // Tras una letra (\Delta x) el espacio solo cierra el comando: "Δx".
      // Tras relaciones/operadores (\leq, \in) o funciones (\sin x) se conserva.
      if (m && this.s[this.i] === ' ' && /^\p{L}$/u.test(out) && /[A-Za-z0-9]/.test(this.s[this.i + 1] ?? '')) {
        this.i++;
      }
      return out;
    }
    return name; // comando desconocido: se muestra el nombre sin la barra
  }
}

/** Expresión simple: un solo "átomo" sin operadores ni espacios (no necesita paréntesis). */
function wrap(expr: string) {
  const t = expr.trim();
  return /^[\p{L}\p{N}.,′°√∛∜⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉]+$/u.test(t) ? t : `(${t})`;
}

function script(content: string, map: Record<string, string>, mark: string) {
  const chars = [...content];
  if (chars.length > 0 && chars.every((c) => map[c] !== undefined)) {
    return chars.map((c) => map[c]).join('');
  }
  // No todos los caracteres tienen versión super/subíndice en Unicode
  return chars.length === 1 ? `${mark}${content}` : `${mark}(${content})`;
}

/** Convierte una expresión LaTeX (sin delimitadores) a texto Unicode. */
export function latexExpressionToUnicode(expr: string): string {
  return new Parser(expr).parse().replace(/[ \t]{2,}/g, (m) => (m.length > 3 ? m : ' '));
}

const LOOKS_LIKE_LATEX = /[\\^_{}]/;

/**
 * Reemplaza las fórmulas $...$ y \( ... \) de un texto por su versión Unicode.
 * Lo que está entre $ y no parece LaTeX (ej: "cuesta $100 y $200") queda igual.
 */
export function renderLatex(text: string | null | undefined): string {
  if (!text) return text ?? '';
  if (!text.includes('$') && !text.includes('\\(')) return text;
  return text
    .replace(/\\\((.+?)\\\)/g, (_m, expr: string) => latexExpressionToUnicode(expr))
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (m, pre: string, expr: string) =>
      LOOKS_LIKE_LATEX.test(expr) ? `${pre}${latexExpressionToUnicode(expr)}` : m,
    )
    .replace(/\\\$/g, '$');
}

type QuestionTextFields = {
  statement: string;
  options: unknown;
  modelAnswer: string | null;
};

/** Copia de la pregunta con las fórmulas LaTeX convertidas en enunciado, opciones y respuesta modelo. */
export function renderQuestionLatex<T extends QuestionTextFields>(q: T): T {
  const options = Array.isArray(q.options)
    ? (q.options as unknown[]).map((o) => {
      if (typeof o === 'string') return renderLatex(o);
      if (o && typeof o === 'object' && typeof (o as { statement?: unknown }).statement === 'string') {
        return { ...(o as object), statement: renderLatex((o as { statement: string }).statement) };
      }
      return o;
    })
    : q.options;
  return {
    ...q,
    statement: renderLatex(q.statement),
    options,
    modelAnswer: q.modelAnswer ? renderLatex(q.modelAnswer) : q.modelAnswer,
  };
}
