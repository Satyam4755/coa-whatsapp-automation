const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";
    const response = {
        success: false,
        message,
    };

    if (process.env.NODE_ENV !== "production") {
        response.stack = err.stack;
    }

    return res.status(statusCode).json(response)

}

export default errorMiddleware
