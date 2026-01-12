# Base image: Ubuntu 22.04
FROM ubuntu:22.04

# Avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.11
RUN apt-get update && apt-get install -y software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y python3.11 python3.11-venv python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install code-server (latest stable) with retry logic for flaky network
RUN for i in 1 2 3 4 5; do \
    curl -fsSL https://code-server.dev/install.sh | sh && break || \
    echo "Attempt $i failed, retrying in 5s..." && sleep 5; \
    done

# Create a non-root user
RUN useradd -m -s /bin/bash coder

# Set working directory
WORKDIR /workspace

# Copy starter project files
COPY --chown=coder:coder starter-workspace/ /workspace/
# Also copy to /opt/starter so we can force-update config files in entrypoint
# (This ensures updates apply even if /workspace volume is old/persisted)
COPY --chown=coder:coder starter-workspace/ /opt/starter/

# Switch to non-root user
USER coder

# Configure code-server
RUN mkdir -p /home/coder/.config/code-server
RUN echo "bind-addr: 0.0.0.0:8080" > /home/coder/.config/code-server/config.yaml \
    && echo "auth: none" >> /home/coder/.config/code-server/config.yaml \
    && echo "cert: false" >> /home/coder/.config/code-server/config.yaml

# Configure VS Code user settings for auto-configuration
RUN mkdir -p /home/coder/.local/share/code-server/User
COPY --chown=coder:coder settings.json /home/coder/.local/share/code-server/User/settings.json

# Configure user-local npm global directory
ENV NPM_CONFIG_PREFIX=/home/coder/.npm-global
ENV PATH="/home/coder/.npm-global/bin:${PATH}"

# Install Claude CLI
# Using npm global install (package name is @anthropic-ai/claude-code)
RUN mkdir -p /home/coder/.npm-global \
    && npm install -g @anthropic-ai/claude-code

# Copy entrypoint script (needs to be done as root, then fix permissions)
# Also convert Windows CRLF line endings to Unix LF
USER root
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
USER coder


# Expose code-server port
EXPOSE 8080

# Use entrypoint script to clear cached Claude credentials before starting
ENTRYPOINT ["/entrypoint.sh"]
