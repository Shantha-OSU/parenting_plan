class QuestionLogicHandler {
    // this maps operator codes to their "evaluation functions"
    #operators = {
        'eq': (a, b) => a === b, // equals
        'neq': (a, b) => a !== b, // not equals
        'gt': (a, b) => a > b, // greater than
        'gte': (a, b) => a >= b, // greater than or equal to
        'lt': (a, b) => a < b, // less than
        'lte': (a, b) => a <= b, // less than or equal to
        'in': (a, b) => Array.isArray(b) && b.includes(a), // is in array of values
        'nin': (a, b) => Array.isArray(b) && !b.includes(a), // is not in array of values
    };

    // takes in a two values and an operator and returns a boolean of the parameters' evaluation
    evaluate(leftVal, opCode, rightVal) {
        const fn = this.#operators[opCode];
        if (!fn) throw new Error(`Unsupported operator: ${opCode}`);
        return fn(leftVal, rightVal);
    }
}

// export a single instance of QuestionLogicHandler since we don't really need different instances of it
const questionLogicHandler = new QuestionLogicHandler();
export default questionLogicHandler
