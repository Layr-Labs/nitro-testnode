FROM node:18-bullseye-slim


# Install necessary packages
RUN apt-get update && \
    apt-get install -y git docker.io python3 build-essential curl jq

# Create workspace
WORKDIR /workspace
# Clone the repository and checkout the specified branch
RUN git clone --no-checkout https://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@github.com/layr-labs/nitro-contracts-private ./
RUN git checkout 81fa76a31bde7bc0286390ddc2ee3dce4af9f68f

# ensure create-rollup-testnode command is in package.json
RUN jq -e '.scripts["create-rollup-testnode"]' package.json > /dev/null || (echo "Error: 'create-rollup-testnode' not found in package.json" && exit 1)


# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup

# Setup scripts and dependencies
RUN touch scripts/config.ts
RUN yarn install
RUN yarn build:all


ENTRYPOINT ["yarn"]
