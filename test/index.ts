import tester from '../src/tester';

tester.config(2, {
	// tabLength: 4
});

class MyError extends Error {
	constructor(msg: string) {
		super(msg);
	}
}

const checkFunction = () => false;

function testeando1() {
	const test = tester('uno');


	test('chorra-uno', function () {
		this.warn("Miame")
		this.equals(5, 5);

	})

	test('otro-chorra-uno', function () {
		this.info("Ya no me mies")
		this.equals(5, 5);
		this.thrown(() => {
			throw new MyError('Pollas')
		}, Error)
	})

}

function testeando2() {
	const test = tester('dos ');


	test('chorra-dos', function () {
		this.warn("Miame otra vez")
		this.equals(5, 6);
		this.exec(checkFunction);
		this.exec(() => {
			for (let i = 0; i < 1000 * 100000; i++);
			return true
		});

	})

	test('otro-chorra-dos', function () {
		this.info("Ya no me mies")
		this.partial({
			a: 5,
			b: 6
		}, {
			a: 5,
			b: 7,
			c: 8
		});
	})

}


tester.run(testeando1, testeando2)

