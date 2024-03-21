import { TextStream } from "../utils/textstream";

export enum TokenID {
  PLUS,           // +
  MINUS,          // -
  STAR,           // *
  SLASH,          // /
  PERCENT,        // %
  ACCENT,         // ^
  HASH,           // #
  LOWER,          // <
  GREATER,        // >
  ASSIGN,         // =
  PAR_OPEN,       // (
  PAR_CLOSE,      // )
  CBR_OPEN,       // {
  CBR_CLOSE,      // }
  SBR_OPEN,       // [
  SBR_CLOSE,      // ]
  SEMICOLON,      // ;
  COLON,          // :
  COMMA,          // ,
  DOT,            // .

  EQUAL,          // ==
  NOT_EQUAL,      // ~= or !=
  LOWER_EQUAL,    // <=
  GREATER_EQUAL,  // >=
  CONCAT,         // ..
  DOTS,           // ...

  // keywords
  KEYWORDS_BEGIN,

  AND = KEYWORDS_BEGIN,
  BREAK,
  DO,
  ELSE,
  ELSEIF,
  END,
  FALSE,
  FOR,
  FUNCTION,
  IF,
  IN,
  LOCAL,
  NIL,
  NOT,
  OR,
  REPEAT,
  RETURN,
  THEN,
  TRUE,
  UNTIL,
  WHILE,

  // complex tokens
  COMPLEX_BEGIN,

  NAME = COMPLEX_BEGIN,
  STRING,
  NUMBER
};

const KEYWORDS_NAMES: Map<string, TokenID> = new Map([
  [ "and",      TokenID.AND      ],
  [ "break",    TokenID.BREAK    ],
  [ "do",       TokenID.DO       ],
  [ "else",     TokenID.ELSE     ],
  [ "elseif",   TokenID.ELSEIF   ],
  [ "end",      TokenID.END      ],
  [ "false",    TokenID.FALSE    ],
  [ "for",      TokenID.FOR      ],
  [ "function", TokenID.FUNCTION ],
  [ "if",       TokenID.IF       ],
  [ "in",       TokenID.IN       ],
  [ "local",    TokenID.LOCAL    ],
  [ "nil",      TokenID.NIL      ],
  [ "not",      TokenID.NOT      ],
  [ "or",       TokenID.OR       ],
  [ "repeat",   TokenID.REPEAT   ],
  [ "return",   TokenID.RETURN   ],
  [ "then",     TokenID.THEN     ],
  [ "true",     TokenID.TRUE     ],
  [ "until",    TokenID.UNTIL    ],
  [ "while",    TokenID.WHILE    ],
]);

const OTHER_TOKENS_MAP: Map<string, TokenID> = new Map([
  [ '+', TokenID.PLUS      ],
  [ '-', TokenID.MINUS     ],
  [ '*', TokenID.STAR      ],
  [ '/', TokenID.SLASH     ],
  [ '%', TokenID.PERCENT   ],
  [ '^', TokenID.ACCENT    ],
  [ '#', TokenID.HASH      ],
  [ '(', TokenID.PAR_OPEN  ],
  [ ')', TokenID.PAR_CLOSE ],
  [ '{', TokenID.CBR_OPEN  ],
  [ '}', TokenID.CBR_CLOSE ],
  [ '[', TokenID.SBR_OPEN  ],
  [ ']', TokenID.SBR_CLOSE ],
  [ ';', TokenID.SEMICOLON ],
  [ ':', TokenID.COLON     ],
  [ ',', TokenID.COMMA     ],
]);

export class Token {
  id: TokenID
  line: number
  column: number

  constructor(id: TokenID, line: number, column: number) {
    this.id = id;
    this.line = line;
    this.column = column;
  }
};

export enum NumberType {
  FLOAT,
  INTEGER
};

export class NumberToken extends Token {
  type: NumberType
  value: number

  constructor(type: NumberType, value: number, line: number, column: number) {
    super(TokenID.NUMBER, line, column);

    this.type = type;
    this.value = value;
  }
};

export class NameToken extends Token {
  value: string

  constructor(value: string, line: number, column: number) {
    super(TokenID.NAME, line, column);

    this.value = value;
  }
};

export class StringToken extends NameToken {
  constructor(value: string, line: number, column: number) {
    super(value, line, column);
    this.id = TokenID.STRING;
  }
};

export class LexerError extends Error {
  line: number
  column: number

  constructor(line: number, column: number, info: string) {
    super(info);

    this.line = line;
    this.column = column;
  }
}

export class Lexer {
  private m_ts: TextStream;
  private m_res: Token[];

  constructor(ts: TextStream) {
    this.m_ts = ts;
    this.m_res = [];
  }

  getResult(): Token[] {
    return this.m_res;
  }

  private throw(info: string): never {
    throw new LexerError(this.m_ts.line(), this.m_ts.column(), info);
  }

  private readMultilineString(): Token {
    const ts = this.m_ts;
    const line = ts.line();
    const column = ts.column();

    ts.skip(2);
    let content = "";

    while (!ts.test(/\]\]/)) {
      if (ts.isEnd())
        this.throw("Unexpected end of file with unfinished multiline string");

      content += ts.read1();
    }

    ts.skip(2);

    return new StringToken(content, line, column);
  }

  private readString(): Token {
    const ts = this.m_ts;
    const line = ts.line();
    const column = ts.column();
    
    const opener = ts.read1();
    let content = "";

    while (ts.peek() !== opener) {
      if (ts.isEnd())
        this.throw("Unexpected end of file with unfinished string");

      let char = ts.read1();

      // Escape sequence
      if (char === '\\') {
        // TODO:
        // hexes in strings (\x00)
        // and decimals (\000)
        switch (ts.peek()) {
          case 'n':
            char = '\n';
            break;
          case 't':
            char = '\t';
            break;
          case '\\':
            char = '\\';
            break;
          case 'b':
            char = '\b';
            break;
          case 'f':
            char = '\f';
            break;
          case 'r':
            char = '\r';
            break;
          case 'v':
            char = '\v';
            break;
          case '"':
            char = '"';
            break;
          case '\'':
            char = '\'';
            break;
          default:
            this.throw("Invalid escape sequence");
        }

        ts.skip(1);
      }

      content += char;
    }

    ts.skip(1);

    return new StringToken(content, line, column);
  }

  private readWord(): Token {
    const ts = this.m_ts;
    const line = ts.line();
    const column = ts.column();

    let content = "";
    content += ts.read1();

    while (ts.isAlpha() || ts.isDec())
      content += ts.read1();

    const keywordId = KEYWORDS_NAMES.get(content.toLowerCase());

    if (keywordId === undefined)
      return new NameToken(content, line, column);

    return new Token(keywordId, line, column);
  }

  private readNumber(): Token {
    const ts = this.m_ts;
    const line = ts.line();
    const column = ts.column();

    let isHex = false;
    let numberString = "";
    numberString += ts.read1();
    
    if (numberString == '0') {
      if (ts.is(/[xX]/)) {
        isHex = true;
        numberString += ts.read1();

        // al least 1 digit expected
        if (!ts.isHex())
          this.throw("Invalid number (expected hex)");
      }
      else if (!ts.isDec())
        this.throw("Invalid number (expected decimal)");
    }

    const isDigit = 
      isHex ? () => { return ts.isHex(); }
            : () => { return ts.isDec(); }

    while (isDigit())
      numberString += ts.read1();

    if (ts.isAlpha())
      this.throw("Invalid number");

    return new NumberToken(NumberType.INTEGER, Number(numberString), line, column);
  }

  private handleOtherTokens(): boolean {
    const ts = this.m_ts;
    const rs = this.m_res;

    const tokenId = OTHER_TOKENS_MAP.get(ts.peek());

    if (tokenId !== undefined) {
      rs.push(new Token(tokenId, ts.line(), ts.column()));
      ts.skip(1);
      return true;
    }

    const line = ts.line();
    const column = ts.column();

    switch (ts.peek()) {
      case '=':
        ts.skip(1);

        if (ts.peek() !== '=') {
          rs.push(new Token(TokenID.ASSIGN, line, column));
          break;
        }

        rs.push(new Token(TokenID.EQUAL, line, column));
        ts.skip(1);

        break;
      case '<':
        ts.skip(1);

        if (ts.peek() !== '=') {
          rs.push(new Token(TokenID.LOWER, line, column));
          break;
        }

        rs.push(new Token(TokenID.LOWER_EQUAL, line, column));
        ts.skip(1);

        break;
      case '>':
        ts.skip(1);

        if (ts.peek() !== '=') {
          rs.push(new Token(TokenID.GREATER, line, column));
          break;
        }

        rs.push(new Token(TokenID.GREATER_EQUAL, line, column));
        ts.skip(1);

        break;
      case '.':
        ts.skip(1);

        if (ts.peek() !== '.') {
          rs.push(new Token(TokenID.DOT, line, column));
          break;
        }

        ts.skip(1);

        if (ts.peek() !== '.') {
          rs.push(new Token(TokenID.CONCAT, line, column));
          break;
        }

        rs.push(new Token(TokenID.DOTS, line, column));
        ts.skip(1);

        break;
      case '~':
      case '!':
        ts.skip(1);
        if (ts.peek() === '=') {
          rs.push(new Token(TokenID.NOT_EQUAL, line, column));
          break;
        }

        this.throw("Invalid operator (expected ~= or !=)");
      default:
        return false;
    }

    return true;
  }

  tokenize() {
    const ts = this.m_ts;

    while (!ts.isEnd()) {
      ts.skipSpaces();

      // Comment
      if (ts.test(/--/)) {
        ts.skip(2);

        // Multiline comment
        if (ts.test(/\[\[/))
          this.readMultilineString();
        else
          ts.skipToNextLine();

        continue;
      }

      // Name or keyword
      if (ts.isAlpha()) {
        this.m_res.push(this.readWord());
        continue;
      }

      // String
      if (ts.is(/["']/)) {
        this.m_res.push(this.readString());
        continue;
      }

      // Multiline string
      if (ts.is(/\[\[/)) {
        this.m_res.push(this.readMultilineString());
        continue;
      }

      if (ts.isDec()) {
        this.m_res.push(this.readNumber());
        continue;
      }

      if (this.handleOtherTokens())
        continue;

      this.throw("Unknown token");
    }
  }
};
