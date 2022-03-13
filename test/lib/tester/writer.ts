import { Writable } from 'stream';

type ToBeOrNotTobe<T> = {
	(): T;
	(v: T): void
}
export const writer = (stdout: Writable = process.stdout, stderr: Writable = process.stderr) => {
	let indent = 0;
	let verbose = 0;
	const tab = '  ';
	const _writer = function (this: Writable, ...args: any[]) {
		const spc = tab.repeat(indent);
		const str = spc +
			args.map(it => it.toString().replace(/[\n\t]/g, (m: string) => {
				if (m === '\t') return spc;
				return '\n' + spc
			})
			)
				.join('') +
			'\n';

		this.write(str);
	}


	const _create = (verbosity: number) => {
		const log = function (...args: any[]) {
			if (verbose >= verbosity) {
				_writer.call(stdout, ...args);
				return true;
			}
			return false;
		}
		log.group = (...args: any[]) => {
			if (log(...args)) {
				indent++;
				return true;
			}
			return false;
		}
		log.ungroup = () => {
			if (verbose >= verbosity && indent > 0) --indent;
		}
		return Object.freeze(log);
	}

	return Object.freeze({
		write: _create(0),
		error: _writer.bind(stderr),
		warn: _create(1),
		info: _create(2),
		group: (...args: any[]) => {
			_writer.call(stdout, ...args);
			++indent;
		},
		ungroup: () => {
			if (indent > 0) --indent;
		},
		verbosity: ((value?: number) => {
			if (value === undefined) return verbose;
			verbose = value;
		}) as ToBeOrNotTobe<number>,
		stdout: ((value?: Writable) => {
			if (value === undefined) return stdout;
			stdout = value;
		}) as ToBeOrNotTobe<Writable>,
		stderr: ((value?: Writable) => {
			if (value === undefined) return stderr;
			stderr = value;
		}) as ToBeOrNotTobe<Writable>

	})
}
