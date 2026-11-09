// Prints each spec by name, nested under its describe blocks, and gives specs
// that drive a CLI or a browser room to finish.
import { SpecReporter } from "jasmine-spec-reporter";

jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayPending: true, displayDuration: true } }));
jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
