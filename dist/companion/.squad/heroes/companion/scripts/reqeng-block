const START = '<!-- squad:reqeng-questions -->';
const END = '<!-- /squad:reqeng-questions -->';

export function parseAnswers(input, questions) {
  const groups = input.split(',').map((value) => value.trim()).filter(Boolean);
  const valid = new Set(questions.flatMap(({ number, options }) =>
    options.map((_, index) => `${number}${String.fromCharCode(97 + index)}`)));
  const answers = groups.flatMap((group) => {
    const parts = group.split('+').map((value) => value.trim());
    if (parts.length > 1) {
      const prefix = parts[0].match(/^(\d+)/u)?.[1];
      return parts.map((part, index) => {
        if (index === 0 || /^\d+/u.test(part)) return part;
        return `${prefix ?? ''}${part}`;
      });
    }
    return parts;
  });
  const invalid = answers.filter((answer) => !valid.has(answer));
  if (invalid.length) throw new Error(`invalid or ambiguous answers: ${invalid.join(', ')}`);
  const selectedByGroup = groups.map((group) => group.match(/^(\d+)/u)?.[1]);
  if (new Set(selectedByGroup).size !== selectedByGroup.length) {
    throw new Error('invalid or ambiguous answers: one group is required per question');
  }
  for (const question of questions) {
    const selected = answers.filter((answer) => answer.startsWith(String(question.number)));
    if (new Set(selected).size !== selected.length) {
      throw new Error(`invalid or ambiguous answers for ${question.number}`);
    }
  }
  return answers;
}

export function renderQuestionBlock(questions) {
  const ordered = [...questions].sort((left, right) => Number(right.blocking) - Number(left.blocking));
  const body = ordered.map((question) => {
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
