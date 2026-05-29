import { ApiError } from "../utils/ApiError.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join("."), message: d.message }));
      throw ApiError.badRequest("Validation failed", details);
    }
    req[source] = value;
    next();
  };
}
