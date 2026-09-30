module.exports = {
  apps: [
    {
      name: "aws-local-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3050",
      cwd: "/home/pratham/Disk2/aws_local",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3050",
      },
    },
  ],
};
