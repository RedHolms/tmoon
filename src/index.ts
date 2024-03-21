import { Lexer, LexerError } from "./small-lua/lexer";
import { TextStream } from "./utils/textstream";

// const string = `1234567890
// -1234567890
// 1234567890.0123456789
// -1234567890.0123456789
// 1234567890.
// -1234567890.
// .0123456789
// -.0123456789
// 01234567
// 0x123456789ABCDEF0
// 0x123456789abcdef0
// 0b10101010
// 1234567890.0123456789e1234567890
// 1234567890.e1234567890
// .0123456789e1234567890
// 1234567890e1234567890
// 1234567890.0123456789E1234567890
// 1234567890.E1234567890
// .0123456789E1234567890
// 1234567890E1234567890`;

// console.log(/-[1-9]\d+\s/y.exec(string));

const ts = new TextStream(
`-- SOME COMMENT
--[[
  multi line
  comment



  very long
]]

while true do
  print("HELLO","WORLD","!");
  leftSide..rightSide;
  SomeTable.SomeIndex;
  varargFunction(...);

  local MYVAR_HEX = 0xFF;
  local MYVAR_DEC = 1234;
end`
);

const lex = new Lexer(ts);

try {
  lex.tokenize();
  console.log(lex.getResult());
} catch(error) {
  if (!(error instanceof LexerError))
    throw error;

  console.log("%s at %d:%d", error.message, error.line, error.column);
}

