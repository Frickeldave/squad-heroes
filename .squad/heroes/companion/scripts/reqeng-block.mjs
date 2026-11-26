const START = '<!-- squad:reqeng-questions -->';
const END = '<!-- /squad:reqeng-questions -->';

export function parseAnswers(input, questions) {
  const answers = input.split(',').map((value) => value.trim()).filter(Boolean);
  const valid = new Set(questions.flatMap(({ number, options }) =>
    options.map((_, index) => `${number}${String.fromCharCode(97 + index)}`)));
  const invalid = answers.filter((answer) => !valid.has(answer));
  if (invalid.length) throw new Error(`invalid or ambiguous answers: ${invalid.join(', ')}`);
  return answers;
}

export function renderQuestionBlock(questions) {
  const body = questions.map((question) => {
    const options = question.options.map((option, index) =>
      `${question.number}${String.fromCharCode(97 + index)}. ${option}`).join('\n');
    return `${question.number}. ${question.title}\n${question.blocking ? 'BLOCKING' : 'OPTIONAL'}\nOwner: ${question.owner}\nStatus: open\n${options}`;
  }).join('\n\n');
  return `${START}\n${body}\n${END}`;
}

export function replaceQuestionBlock(body, questions) {
  const next = renderQuestionBlock(questions);
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start === -1 && end === -1) return `${body.trimEnd()}\n\n${next}\n`;
  if (start === -1 || end < start || body.indexOf(START, start + START.length) !== -1 ||
      body.indexOf(END, end + END.length) !== -1) {
    throw new Error('ambiguous ReqEng marker block');
  }
  return body.slice(0, start) + next + body.slice(end + END.length);
}
