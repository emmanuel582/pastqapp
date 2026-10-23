export interface GradableQuestion {
  correct?: number | string | null;
  options: string[];
  subject: string;
  type?: string;
}

export function answerIndex(question: GradableQuestion): number | null {
  if (question.type === "theory" || question.type === "short_answer")
    return null;
  if (question.correct == null || question.correct === "") return null;
  const index = Number(question.correct);
  return Number.isInteger(index) &&
    index >= 0 &&
    index < question.options.length
    ? index
    : null;
}

export function sessionSummary(
  questions: GradableQuestion[],
  answers: (number | null)[],
) {
  let correct = 0,
    incorrect = 0,
    skipped = 0,
    ungraded = 0,
    graded = 0;
  questions.forEach((question, i) => {
    const key = answerIndex(question);
    if (key !== null) graded++;
    if (answers[i] == null) skipped++;
    else if (key === null) ungraded++;
    else if (answers[i] === key) correct++;
    else incorrect++;
  });
  return {
    correct,
    incorrect,
    skipped,
    ungraded,
    graded,
    answered: questions.length - skipped,
    percent: graded ? Math.round((correct / graded) * 100) : null,
  };
}

export interface ToolRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function fitTool(
  rect: ToolRect,
  viewport: { width: number; height: number },
): ToolRect {
  const width = Math.min(
    Math.max(260, rect.width),
    Math.max(120, viewport.width - 16),
  );
  const height = Math.min(
    Math.max(370, rect.height),
    Math.max(120, viewport.height - 16),
  );
  return {
    width,
    height,
    x: Math.max(8, Math.min(rect.x, viewport.width - width - 8)),
    y: Math.max(8, Math.min(rect.y, viewport.height - height - 8)),
  };
}

/** Small arithmetic parser: calculator input never executes JavaScript. */
export function calculate(expression: string): string {
  if (expression.length > 512) throw new Error("Expression too long");
  const input = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const tokens = input.match(/\d*\.?\d+(?:e[+-]?\d+)?|[()+\-*/]/gi) || [];
  if (
    tokens.join("").toLowerCase() !== input.replace(/\s/g, "").toLowerCase() ||
    !tokens.length
  )
    throw new Error("Invalid expression");
  let position = 0;
  const peek = () => tokens[position];
  function atom(): number {
    const token = tokens[position++];
    let value: number;
    if (token === "(") {
      value = sum();
      if (tokens[position++] !== ")") throw new Error("Close parentheses");
    } else {
      value = Number(token);
      if (!token || !Number.isFinite(value))
        throw new Error("Invalid expression");
    }
    return value;
  }
  function unary(): number {
    if (peek() === "+") {
      position++;
      return unary();
    }
    if (peek() === "-") {
      position++;
      return -unary();
    }
    return atom();
  }
  function product(): number {
    let value = unary();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[position++];
      const right = unary();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[position++];
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  if (position !== tokens.length || !Number.isFinite(result))
    throw new Error("Invalid expression");
  return String(Number(result.toPrecision(12)));
}
