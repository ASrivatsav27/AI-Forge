export function errorHandler(err, req, res, next) {
    console.error(err.stack);
    res.status(500).json({ message: "Internal server error" });
}
//# sourceMappingURL=error-handler.js.map