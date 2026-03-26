#!/bin/bash
set -e

echo "🚀 Starting Deployment Process..."

# 1. AWS EC2 Deployment for Backend
echo "☁️ Provisioning AWS EC2 for Nakama Server..."

# Get the default VPC
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
    echo "⚠️ No default VPC found. Make sure you have a default VPC in your AWS account."
    exit 1
fi

echo "✅ Found default VPC: $VPC_ID"

# Create Security Group
SG_NAME="nakama-sg-$(date +%s)"
SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" --description "Security group for Nakama Server" --vpc-id "$VPC_ID" --query "GroupId" --output text)

echo "✅ Created Security Group: $SG_ID"

# Add rules mapping to Nakama and SSH
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 7350 --cidr 0.0.0.0/0 # Nakama API/WebSocket
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 7351 --cidr 0.0.0.0/0 # Nakama Console

# Create an SSH Key Pair
KEY_NAME="nakama-key-$(date +%s)"
aws ec2 create-key-pair --key-name "$KEY_NAME" --query "KeyMaterial" --output text > "$KEY_NAME.pem"
chmod 400 "$KEY_NAME.pem"
echo "✅ Created AWS Key Pair: $KEY_NAME.pem"

# Get Latest Ubuntu 22.04 LTS AMI in the current region
AMI_ID=$(aws ssm get-parameters --names /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query "Parameters[0].Value" --output text)

echo "✅ Using Ubuntu 22.04 AMI: $AMI_ID"

# Create UserData script to auto-install docker and start the app
cat << 'EOF' > user-data.sh
#!/bin/bash
# Install Docker
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker

# Clone repo and run
cd /home/ubuntu
git clone https://github.com/Vikas350/Lila_Games_Tic_Tac_Toe.git
cd Lila_Games_Tic_Tac_Toe
sudo docker compose up --build -d
EOF

# Launch the EC2 Instance!
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type t3.micro \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data file://user-data.sh \
    --query "Instances[0].InstanceId" \
    --output text)

echo "✅ Launched EC2 Instance: $INSTANCE_ID. Waiting for it to boot..."

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

# Get the Public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo "🎉 Nakama Server Backend deployed at: $PUBLIC_IP"
echo "Note: It will take a few minutes for the user-data script to finish installing Docker and booting the Nakama containers."
echo "You can check the dashboard at http://$PUBLIC_IP:7351 once it's up."

# 2. Vercel Frontend Deployment
echo "🌐 Deploying React Frontend to Vercel..."
echo "Configuring Vercel frontend with Nakama Host: $PUBLIC_IP"

# Create production env file so Vercel builds with the correct IP
cd frontend
cat << EOF > .env.local
VITE_NAKAMA_HOST=$PUBLIC_IP
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
EOF

echo "Running npx vercel deploy --prod..."
# Use Vercel CLI (requires auth, it will prompt if not logged in)
npx vercel build --yes
npx vercel deploy --prebuilt --prod

echo "🚀 Everything is complete!"
