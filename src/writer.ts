import { Writable } from "stream";

export interface IWriter {
	(...args: any[]): void;
	group: (...args: any[]) => void;
	ungroup: (...args: any[]) => void
}

export interface ILogger {
	log: IWriter,
	warn: IWriter,
	info: IWriter
}

type Owner = {
	output: string
}

export class Writer {
	public static readonly INFO = 2;
	public static readonly WARN = 1;
	public static readonly LOG = 0;

	public static verbosity = 1;
	public static tabLength = 2;
	public static tabs: number = 0;

	public static create(destiny: Writable | Owner): Writer {
		return destiny instanceof Writable ?
			new WriterStream(destiny) :
			new WriterString(destiny);

	}

	public static logger(destiny: Writable | Owner | Writer) {
		const writer = destiny instanceof Writer ?
			destiny :
			Writer.create(destiny);

		return logger(writer);
	}

	public static write(destiny: Writable | Owner) {
		const writer = Writer.create(destiny);
		return (...args: any[]) => writer.write(args);
	}

	public static adapter(tabs: number, ...args: any[]): string;
	public static adapter(...args: any[]): string;
	public static adapter(...args: any[]) {
		let level = 0;
		let rest: any[] = args;;
		if (args.length && typeof args[0] === 'number') [level, ...rest] = args;
		return mount(rest, level);
	}

	public static readonly isInfoLevel = () => Writer.verbosity == 2;
	public static readonly isWarnLevel = () => Writer.verbosity >= 1;




	public write(args: any[]) { }

	public group(args: any[]) {
		if (args.length) this.write(args);
		Writer.tabs++;
	}
	public ungroup(args: any[]) {
		if (args.length) this.write(args);
		if (Writer.tabs > 0) Writer.tabs--;
	}
}

class WriterString extends Writer {
	private _owner: Owner;
	constructor(owner: Owner) {
		super();
		this._owner = owner;
	}
	public write(args: any[]): void { this._owner.output += mount(args); }
}
class WriterStream extends Writer {
	private _out: Writable;
	constructor(out: Writable) {
		super();
		this._out = out;
	}
	public write(args: any[]): void { this._out.write(mount(args)); }
}

const mount = (args: any[], tabs = 0) => {
	const tab = ' '.repeat(Writer.tabLength);
	const spc = tab.repeat((tabs || Writer.tabs));
	const res = spc +
		args.map(it => it.toString().replace(/[\n\t]/g, (m: string) => {
			if (m === '\t') return tab;
			return '\n' + spc
		})
		)
			.join('') +
		'\n';

	return res;
}

const logger = (writer: Writer) => {
	const log = function (level: number): IWriter {
		const write = (...args: any[]) => {
			if (Writer.verbosity >= level) writer.write(args)
		}
		write.group = (...args: any[]) => {
			if (Writer.verbosity >= level) writer.group(args)
		}
		write.ungroup = (...args: any[]) => {
			if (Writer.verbosity >= level) writer.ungroup(args);
		}
		return write;
	}

	return {
		log: log(0),
		warn: log(1),
		info: log(2),
	}
}


