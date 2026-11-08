// Local oxlint plugin: code comments are written in English. Polish letters are the cheap signal;
// Polish written without them is not caught.

const POLISH_LETTER = /[ąćęłńóśźż]/iu;

const englishOnlyRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow Polish letters in code comments' },
    messages: { polish: 'Write code comments in English (this comment contains Polish letters).' }
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (POLISH_LETTER.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: 'polish' });
          }
        }
      }
    };
  }
};

export default {
  meta: { name: 'comments' },
  rules: { 'english-only': englishOnlyRule }
};
