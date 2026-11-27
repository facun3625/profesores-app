import { renderLatex } from './latex';

describe('renderLatex', () => {
  it.each([
    ['Resolver $x^2 + y^2 = r^2$', 'Resolver x² + y² = r²'],
    ['$\\frac{1}{2}$ de pizza', '1/2 de pizza'],
    ['$\\frac{a+b}{c}$', '(a+b)/c'],
    ['$\\sqrt{x}$ y $\\sqrt{x+1}$', '√x y √(x+1)'],
    ['$\\sqrt[3]{8} = 2$', '∛8 = 2'],
    ['$\\alpha \\leq \\beta$', 'α ≤ β'],
    ['Fórmula del agua: $H_2O$', 'Fórmula del agua: H₂O'],
    ['$\\int_0^1 f(x)\\,dx$', '∫₀¹ f(x) dx'],
    ['$x \\in \\mathbb{R}$', 'x ∈ ℝ'],
    ['$e^{i\\pi} + 1 = 0$', 'e^(iπ) + 1 = 0'],
    ['$\\sum_{i=1}^{n} i$', '∑ᵢ₌₁ⁿ i'],
    ['$v = \\frac{\\Delta x}{\\Delta t}$', 'v = Δx/Δt'],
    ['$30^\\circ$', '30°'],
    ['$2 \\times 10^{-3}\\text{ m}$', '2 × 10⁻³ m'],
    ['\\(a \\neq b\\)', 'a ≠ b'],
  ])('%s', (input, expected) => {
    expect(renderLatex(input)).toBe(expected);
  });

  it('no toca precios ni texto sin fórmulas', () => {
    expect(renderLatex('Cuesta $100 y $200')).toBe('Cuesta $100 y $200');
    expect(renderLatex('Sin fórmulas')).toBe('Sin fórmulas');
    expect(renderLatex(null)).toBe('');
  });

  it('respeta los huecos de completar', () => {
    expect(renderLatex('El área es $\\pi r^2$ = [[πr²]]')).toBe('El área es πr² = [[πr²]]');
  });
});

describe('renderLatex funciones', () => {
  it('mantiene el espacio en funciones', () => {
    expect(renderLatex('$\\sin x + \\log y$')).toBe('sin x + log y');
  });
});
