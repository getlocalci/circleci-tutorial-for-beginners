import * as fs from "fs";
import CircleCI from "@circleci/circleci-config-sdk";

const config = new CircleCI.Config();
const workflow = new CircleCI.Workflow("test-lint");
config.addWorkflow(workflow);

const phpVersionParameterName = "php-version-number";
const orbManifest: CircleCI.types.orb.OrbImportManifest = {
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
  orbManifest
);
const phpOrb = new CircleCI.orb.OrbImport(
  "php",
  "circleci",
  "php",
  "1.1",
  undefined,
  orbManifest
);

config.importOrb(nodeOrb);
config.importOrb(phpOrb);

[
  new CircleCI.Job(
    "js-build",
    new CircleCI.executors.DockerExecutor("cimg/node:14.18"),
    [
      new CircleCI.commands.Checkout(),
      new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
      new CircleCI.commands.Run({
        name: "Running JS linting and unit test",
        command: `npm run lint:js \n npm run test:js`,
      }),
    ]
  ),
  new CircleCI.Job(
    "php-lint",
    new CircleCI.executors.DockerExecutor("cimg/php:8.1"),
    [
      new CircleCI.commands.Checkout(),
      new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"]),
      new CircleCI.commands.Run({ command: "composer lint" }),
    ]
  ),
  new CircleCI.reusable.ParameterizedJob(
    "php-test",
    new CircleCI.reusable.ReusableExecutor(
      "php",
      new CircleCI.executors.DockerExecutor(
        "cimg/php:<< parameters.php-version-number >>"
      ),
      new CircleCI.parameters.CustomParametersList([
        new CircleCI.parameters.CustomParameter(
          phpVersionParameterName,
          CircleCI.mapping.ParameterSubtype.STRING
        ),
      ])
    ).executor
  )
    .defineParameter(phpVersionParameterName, "string")
    .addStep(new CircleCI.commands.Checkout())
    .addStep(
      new CircleCI.reusable.ReusedCommand(phpOrb.commands["install-packages"])
    )
    .addStep(new CircleCI.commands.Run({ command: "composer test" })),
  new CircleCI.Job(
    "e2e-test",
    new CircleCI.executors.MachineExecutor("large", "ubuntu-2004:202111-02"),
    [
      new CircleCI.commands.Checkout(),
      new CircleCI.reusable.ReusedCommand(nodeOrb.commands["install-packages"]),
      new CircleCI.commands.Run({
        name: "Running e2e tests",
        command: "npm run wp-env start && npm run test:e2e",
      }),
      new CircleCI.commands.StoreArtifacts({ path: "artifacts" }),
    ]
  ),
].forEach((job) => {
  config.addJob(job);
  workflow.addJob(
    job,
    job.name === "php-test"
      ? { matrix: { [phpVersionParameterName]: ["7.3", "7.4", "8.0", "8.1"] } }
      : undefined
  );
});

fs.writeFile("./dynamicConfig.yml", config.stringify(), () => {});
