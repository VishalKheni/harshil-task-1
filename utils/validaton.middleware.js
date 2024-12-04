module.exports = (schema) => async (req, res, next) => {
    const paths = Object.keys(schema);

    if (!paths.length || !paths.some(path => ['body', 'query', 'params', 'file'].includes(path))) {
        return next();
    }

    for (let path of paths) {
        if (['body', 'query', 'params', 'file'].includes(path)) {
            const dataForValidation = req[path];
            const { value, error } = schema[path].validate(dataForValidation, {
                abortEarly: false,
            });

            if (error) {
                const errorMessage = error.details.map(err => err.message)
                return res.status(400).json({
                    success: false,
                    message: "Validation error",
                    error: errorMessage
                });
            }
            req[path] = value;
        }
    }
    next();
};