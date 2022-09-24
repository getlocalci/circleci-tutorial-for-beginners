import * as fs from "fs";
import CircleCI from "@circleci/circleci-config-sdk";

const config = new CircleCI.Config();
const workflow = new CircleCI.Workflow("test-lint");
config.addWorkflow(workflow);

const nodeExecutor = new CircleCI.executors.DockerExecutor("cimg/node:14.18");
const phpExecutor = new CircleCI.executors.DockerExecutor("cimg/php:8.1");

const reusablePhpExecutor = new CircleCI.reusable.ReusableExecutor(
  "php",
  new CircleCI.executors.DockerExecutor(
    "cimg/php:<< parameters.php-version-number >>"
  ),
  new CircleCI.parameters.CustomParametersList<CircleCI.types.parameter.literals.ExecutorParameterLiteral>(
    [
      new CircleCI.parameters.CustomParameter(
        "php-version-number",
        CircleCI.mapping.ParameterSubtype.STRING
      ),
    ]
  )
);

const e2eExecutor = new CircleCI.executors.MachineExecutor(
  "large",
  "ubuntu-2004:202111-02"
);

const manifest: CircleCI.types.orb.OrbImportManifest = {
  jobs: {},
  commands: {
    "install-packages": new CircleCI.parameters.CustomParametersList(),
  },
  executors: {},
};

const nodeOrb = new CircleCI.orb.OrbImport(
  "node",
  "circleci",
  "node",
  "5.0",
  undefined,
  manifest
);
const phpOrb = new CircleCI.orb.OrbImport(
  "php",
  "circleci",
  "php",
  "1.1",
  undefined,
  manifest
);

config.importOrb(nodeOrb);
config.importOrb(phpOrb);

[
  new CircleCI.Job("js-build", nodeExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
    new CircleCI.commands.Run({
      name: "Running JS linting and unit test",
      command: `npm run lint:js \n npm run test:js`,
    }),
  ]),
  new CircleCI.Job("php-lint", phpExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"]),
    new CircleCI.commands.Run({ command: "composer lint" }),
  ]),
  new CircleCI.reusable.ParameterizedJob(
    "php-test",
    reusablePhpExecutor.executor
  )
    .defineParameter("php-version-number", "string")
    .addStep(new CircleCI.commands.Checkout())
    .addStep(
      new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"])
    )
    .addStep(new CircleCI.commands.Run({ command: "composer test" })),
  new CircleCI.Job("e2e-test", e2eExecutor, [
    new CircleCI.commands.Checkout(),
    new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
    new CircleCI.commands.Run({
      name: "Running e2e tests",
      command: "npm run wp-env start && npm run test:e2e",
    }),
    new CircleCI.commands.StoreArtifacts({ path: "artifacts" }),
  ]),
].forEach((job) => {
  config.addJob(job);
  workflow.addJob(
    job,
    job.name === "php-test"
      ? { matrix: { "php-version-number": ["7.3", "7.4", "8.0", "8.1"] } }
      : undefined
  );
});

fs.writeFile("./dynamicConfig.yml", config.stringify(), () => {});
