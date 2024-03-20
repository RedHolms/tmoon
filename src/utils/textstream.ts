type CharMask = (ch: string | number) => boolean;

function generateMask(regex: RegExp): CharMask {
  return (ch) => {
    if (typeof ch === "number")
      ch = String.fromCharCode(ch);
    return regex.test(ch);
  };
}

const isspace = generateMask(/\s/);
const isalpha = generateMask(/[a-zA-Z_]/);
const isdec = generateMask(/[0-9]/);
const isoct = generateMask(/[0-7]/);
const ishex = generateMask(/[0-9A-F]/);
const isbin = generateMask(/[0-1]/);
const isnewln = generateMask(/\n/);

export class TextStream {
  private m_data: string
  private m_p: number

  constructor(data?: string) {
    this.m_data = data || "";
    this.m_p = 0;
  }

  tell(): number {
    return this.m_p;
  }

  seek(line: number, column: number): void;
  seek(char: number): void;

  seek(lineOrChar: number, column?: number) {
    if (column !== undefined) {
      this.seekByLineAndColumn(lineOrChar, column);
    } else {
      this.m_p = lineOrChar;
    }
  }

  private seekByLineAndColumn(line: number, column: number) {
    let cline = 1;
    let ccol = 1;
    let cp = 0;

    while (true) {
      if (cp >= this.m_data.length)
        throw Error("out of bounds");

      if (cline === line && ccol === column)
        return;

      const code = this.m_data.charCodeAt(cp);
      ++cp;

      if (isnewln(code)) {
        ++cline;
        ccol = 1;
      }
    }
  }

  private tellLineAndColumn(): [ number, number ] {
    let cline = 1;
    let ccol = 1;
    let cp = 0;

    while (true) {
      if (cp == this.m_p)
        return [ cline, ccol ];

      const code = this.m_data.charCodeAt(cp);
      ++cp;
      ++ccol;

      if (isnewln(code)) {
        ++cline;
        ccol = 1;
      }
    }
  }

  line(): number {
    return this.tellLineAndColumn()[0];
  }

  column(): number {
    return this.tellLineAndColumn()[1];
  }

  skip(n: number) {
    this.m_p += n;
  }

  peek(): string {
    return this.m_data.slice(this.m_p, this.m_p + 1);
  }

  isSpace(): boolean {
    return isspace(this.peek());
  }

  isAlpha(): boolean {
    return isalpha(this.peek());
  }

  isBin(): boolean {
    return isbin(this.peek());
  }

  isOct(): boolean {
    return isoct(this.peek());
  }

  isDec(): boolean {
    return isdec(this.peek());
  }

  isHex(): boolean {
    return ishex(this.peek());
  }

  isNewLine(): boolean {
    return isnewln(this.peek());
  }

  is(regex: RegExp): boolean {
    return generateMask(regex)(this.peek());
  }

  isEnd(): boolean {
    return this.m_p >= this.m_data.length;
  }

  skipSpaces() {
    while (this.isSpace() || this.isNewLine())
      this.skip(1);
  }

  skipToNextLine() {
    while (!this.isNewLine())
      this.skip(1);
    this.skip(1);
  }

  test(regex: RegExp): boolean {
    const result = regex.exec(this.m_data.slice(this.m_p));

    if (result === null)
      return false;

    return result.index === 0;
  }

  read1(): string {
    const ch = this.m_data.slice(this.m_p, this.m_p + 1);
    this.skip(1);
    return ch;
  }

  readc(): number {
    const ch = this.m_data.charCodeAt(this.m_p);
    this.skip(1);
    return ch;
  }
};

