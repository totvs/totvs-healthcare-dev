import * as vscode from 'vscode';
import { FormattingOptions, DocumentFormattingEditProvider, TextDocument, CancellationToken, TextEdit, Range, Position } from 'vscode';
import { isNullOrUndefined } from 'util';

enum CommentType { SingleLine, MultiLine }
enum StringQuoteType { SingleQuote, DoubleQuote }

export class HealthcareFormattingExtension {

    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    private registerCommands() {
        let provider: HealthcareFormattingProvider = new HealthcareFormattingProvider();
        this.context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('abl', provider));
    }
}

class HealthcareFormattingProvider implements DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): Thenable<TextEdit[]> {
		return this.format(document, null, options);
    }
    
    private format(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise(resolve => {
            let result: TextEdit[] = [];
            if (range === null) {
                var start = new Position(0, 0);
                var end = new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
                range = new Range(start, end);
            }
            var newText: string = new HealthcareFormat().formatAblSource(document.getText(), options);
            result.push(new TextEdit(range, newText));
            return resolve(result);
        });
    }
}

class HealthcareFormat {
    private options: FormattingOptions;

    public formatAblSource(text: string, options: FormattingOptions): string {
        this.options = options;

        let newText = text;
        newText = this.inlineThenElse(newText);
        newText = this.breakMethodParam(newText);
        newText = this.breakWhereStatement(newText);
        newText = this.blockIdent(newText);
        newText = this.specifics(newText);

        return newText;
    }

    /**
     * Alinha os comandos depois do THEN/ELSE
     * @param text texto a ser formatado
     */
    private inlineThenElse(text: string): string {
        // remove quebras de linha depois de then/else
        let regexThenElse = new RegExp(/(then|else){1}([\s\t\n])+/gim);
        return text.replace(regexThenElse, '$1 ');
    }

    /**
     * Adiciona quebra de linha nos parametros de um metodo
     * @param text texto a ser formatado
     */
    private breakWhereStatement(text: string): string {
        let regexParams = new RegExp(/(find|for){1}([^\n]+)(where){1}/gi);
        return text.replace(regexParams, '$1$2\n$3');
    }

    /**
     * Adiciona quebra de linha nos parametros de um metodo
     * @param text texto a ser formatado
     */
    private breakMethodParam(text: string): string {
        let regexParams = new RegExp(/(\(){1}[\s\t]*(input|output){1}/gim);
        return text.replace(regexParams, '$1\n$2');
    }

    /**
     * Tratamentos especificos
     * @param text texto a ser formatado
     */
    private specifics(text: string): string {
        let newText = text;
        newText = this.blockCommand('assign',newText);
        newText = this.blockCommand('def|define',newText,1);
        newText = this.blockCommand('find|for',newText,1,null,this.specificsFind_After);
        newText = this.blockCommand('message',newText);

        return newText;
    }

    // private specificsFind_Before(res: RegExpExecArray) {
    // }

    private specificsFind_After(str: string) {
        let strSplit = str.split('\n');
        strSplit = strSplit.map(line => {
            let strAux = line.trimLeft().toLowerCase();
            if (strAux.startsWith('and'))
                line = '  ' + line;
            else if (strAux.startsWith('or'))
                line = '   ' + line;
            else if (strAux.match(/^(no|shared|exclusive)\-lock/))
                line = '      ' + line;
            return line;
        });
        return strSplit.join('\n');
    }

    /**
     * Alinha linhas adicionais dentro de um comando
     * @param command comando
     * @param text texto a ser formatado
     * @callback beforeExecution Recebe um RegExpExecArray com o bloco encontrado, e pode ter seus valores alterados
     * @callback afterExecution Recebe a string formatada e devolve o texto que vai substituir a mesma
     */
    private blockCommand(command:string,text: string,blockTabs?:number,beforeExecution?:Function,afterExecution?:Function): string {
        let regexCommand = new RegExp(`(^|[\\n\\s\\t]+)(${command})([\\s\\n\\t]+)([\\w\\W]+?)([\\.\\:]{1}[\\s\\n]{1})`, 'gim');

        let res = regexCommand.exec(text);
        while(res) {
            if (!isNullOrUndefined(beforeExecution))
                beforeExecution(res);
            let ident: string;
            if (blockTabs > 0) {
                ident = this.blockTabs(blockTabs);
            }
            else {
                let startLine = '';
                // busca o inicio do comando dentro da linha
                let startIndex = text.lastIndexOf('\n', res.index);
                if (startIndex > 0)
                    startLine = text.substring(startIndex+1, res.index);
                else
                    startLine = text.substring(0, res.index);
                startLine = startLine.trimLeft();
                if (startLine.length > 0)
                    startLine += res[1].replace('\n', '');
                ident = ' '.repeat(startLine.length + res[2].length + 1);
            }
            // substitui dados com identacao
            let str = res[1] + res[2] + res[3] + res[4].replace(/\n/gm, `\n${ident}`) + res[5];
            if (!isNullOrUndefined(afterExecution))
                str = afterExecution(str);
            text = text.substring(0, res.index) + str + text.substring(regexCommand.lastIndex);
            res = regexCommand.exec(text);
        }

        return text;
    }

    /**
     * Alinha os blocos de texto
     * @param text texto a ser formatado
     */
    private blockIdent(text: string): string {
        let depth: number = 0;
        let nextLineDepth: number = 0;
        let prev: string = '';
        let next: string = '';
        let char;
        let textMap: {depth:number,text:string}[] = [];
        let inString: boolean = false;
        let inComment: boolean = false;
        let commentType: CommentType = null;
        let stringChar = null;
        let line = '';
        let keepSpaces = false;
        let statement = '';
        
        for (let i = 0; i < text.length; i++) {
            char = text[i];
            next = text[i + 1];
            prev = text[i - 1];
            
            switch (char) {
                case '/':
                    // se nao está em um comentário ainda
                    if (!inComment && next == '/' || prev == '/') {
                        inComment = true;
                        commentType = CommentType.SingleLine;
                    } 
                    else if (!inComment && next == '*') {
                        inComment = true;
                        commentType = CommentType.MultiLine;
                        if (line.trim() == '')
                            keepSpaces = true;
                    }
                    else if (inComment && commentType == CommentType.MultiLine && prev == '*') {
                        inComment = false;
                        commentType = null;
                    }
                    else if (!inComment)
                        statement += char;
                    line += char;
                    break;
                case '\n':
                    let thisDepth = depth;
                    if (inComment && commentType == CommentType.SingleLine) {
                        inComment = false;
                        commentType = null;
                    }
                    if (!keepSpaces) 
                        line = line.trim();
                    textMap.push({depth: (keepSpaces ? 0 : thisDepth), text: line});
                    line = '';
                    if (inComment && commentType == CommentType.MultiLine)
                        keepSpaces = true;
                    else
                        keepSpaces = false;
                    depth += nextLineDepth;
                    nextLineDepth = 0;
                    break;
                case '"':
                case '\'':
                    if (!inComment) {
                        if (stringChar == char && inString && prev != '~') {
                            inString = false;
                            stringChar = null;
                        } else if (stringChar === null && !inString && prev != '~') {
                            inString = true;
                            stringChar = char;
                        }
                        statement += char;
                    }
                    line += char;
                    break;
                case ':':
                    line += char;
                    if (inString || inComment)
                        break;
                    if (/[^\w\d\-\:\.]/.test(next)) {
                        statement = '';
                        nextLineDepth++;
                    }
                    break;
                case '.':
                    line += char;
                    if (inString || inComment)
                        break;
                    if(/[^\w\d\-\:\.]/i.test(next)) {
                        statement = statement.trimLeft();
                        if (/(\bend\b)/gi.test(line))
                            depth--;
                        // if (/^def/i.test(statement)) {
                        //     nextLineDepth--;
                        // }
                        statement = '';
                    }
                    break;
                case '(':
                    line += char;
                    if (inString || inComment)
                        break;
                    statement += char;
                    nextLineDepth++;
                    break;
                case ')':
                    line += char;
                    if (inString || inComment)
                        break;
                    statement += char;
                    nextLineDepth--;
                    break;
                case '}':
                    line += char;
                    if (inString || inComment)
                        break;
                    statement = '';
                    break;
                default:
                    line += char;
                    if (!inComment && /[\w\d\-\s]/i.test(char))
                        statement += char;
                    break;
            }
            
        }
        // processa ultima linha
        if (!keepSpaces)
            line = line.trim();
        depth += nextLineDepth;
        nextLineDepth = 0;

        textMap.push({depth: (keepSpaces ? 0 : depth), text: line});

        text = textMap.map(ln => { return this.blockTabs(ln.depth) + ln.text; }).join('\n');

        return text;
    }

    private blockTabs(amount: number) {
        amount = amount < 0 ? 0 : amount;
        if (this.options.insertSpaces)
            return ' '.repeat(amount * (this.options.tabSize));
        else
            return '\t'.repeat(amount);
    }
}
