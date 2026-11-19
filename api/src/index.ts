// Entry point: registers every HTTP function (Azure Functions Node.js v4 programming model).
import { app } from "@azure/functions";

app.setup({ enableHttpStream: false });

import "./functions/public";
import "./functions/client";
import "./functions/therapist";
import "./functions/admin";
import "./functions/payments";
