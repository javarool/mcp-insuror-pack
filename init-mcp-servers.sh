#!/bin/bash

# MCP Insuror Pack Initialization Script
# This script initializes all MCP servers in the insuror pack
set -e  # Exit on any error
# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
if ! command_exists node; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    echo "npm is not installed. Please install npm first."
    exit 1
fi

if ! command_exists python3; then
    echo "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

if ! command_exists pip3; then
    echo "pip3 is not installed. Please install pip3 first."
    exit 1
fi

if ! command_exists git; then
    echo "git is not installed. Please install git first."
    exit 1
fi

echo "Prerequisites check passed"
echo ""

# Function to install npm dependencies
install_npm_deps() {
    local dir="$1"
    echo "Installing npm dependencies in $dir..."
    cd "$dir"
    if [ -f "package.json" ]; then
        npm install
        echo "npm dependencies installed in $dir"
    else
        echo "No package.json found in $dir"
    fi
    cd - > /dev/null
}

# Function to install Python dependencies
install_python_deps() {
    local dir="$1"
    echo "Installing Python dependencies in $dir..."
    cd "$dir"

    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
        echo "Python dependencies installed from requirements.txt in $dir"
    elif [ -f "pyproject.toml" ]; then
        pip3 install -e .
        echo "Python package installed from pyproject.toml in $dir"
    else
        echo "No requirements.txt or pyproject.toml found in $dir"
    fi
    cd - > /dev/null
}

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Initialize git submodules if .gitmodules exists
if [ -f ".gitmodules" ]; then
    echo "Initializing git submodules..."
    git submodule update --init --recursive
    echo "Git submodules initialized"
    echo ""
fi

echo "Scanning for MCP servers in insuror pack..."
echo ""

# Initialize Node.js projects
echo "Initializing Node.js MCP servers..."
echo "----------------------------------------"

if [ -d "mcp-telegram-bot" ]; then
    install_npm_deps "mcp-telegram-bot"
    echo ""
fi

if [ -d "vin-decode-mcp" ]; then
    install_npm_deps "vin-decode-mcp"
    echo ""
fi

# Initialize Python projects
echo "Initializing Python MCP servers..."
echo "--------------------------------------"

if [ -d "pdf-template-editor" ]; then
    install_python_deps "pdf-template-editor"
    echo ""
fi