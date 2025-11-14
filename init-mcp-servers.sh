#!/bin/bash

# MCP Insuror Pack Initialization Script
# This script initializes all MCP servers in the insuror pack
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

# Check if python3-venv is available
if ! python3 -m venv --help >/dev/null 2>&1; then
    echo "Warning: python3-venv is not installed. Installing it..."
    if command_exists apt; then
        sudo apt install -y python3-venv python3-full
    else
        echo "Error: Cannot install python3-venv automatically. Please install it manually."
        echo "Run: sudo apt install python3-venv python3-full"
        exit 1
    fi
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

    # Check if venv exists, create if not
    local pip_cmd=""
    if [ -f "venv/bin/pip" ]; then
        pip_cmd="venv/bin/pip"
        echo "Using existing venv in $dir"
    elif [ -f ".venv/bin/pip" ]; then
        pip_cmd=".venv/bin/pip"
        echo "Using existing .venv in $dir"
    else
        echo "No venv found, creating one..."
        if python3 -m venv venv; then
            pip_cmd="venv/bin/pip"
            echo "Virtual environment created successfully"
        else
            echo "Error: Failed to create venv, trying with --user flag"
            pip_cmd="pip3 --user"
        fi
    fi

    if [ -f "requirements.txt" ]; then
        if $pip_cmd install -r requirements.txt; then
            echo "Python dependencies installed from requirements.txt in $dir"
        else
            echo "Error: Failed to install dependencies from requirements.txt in $dir"
        fi
    elif [ -f "pyproject.toml" ]; then
        if $pip_cmd install -e .; then
            echo "Python package installed from pyproject.toml in $dir"
        else
            echo "Error: Failed to install package from pyproject.toml in $dir"
        fi
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

if [ -d "fmcsa-parser" ]; then
    install_npm_deps "fmcsa-parser"
    echo ""
fi

if [ -d "crud-mcp" ]; then
    install_npm_deps "crud-mcp"
    echo ""
fi

# Initialize Python projects
echo "Initializing Python MCP servers..."
echo "--------------------------------------"

if [ -d "pdf-template-editor" ]; then
    install_python_deps "pdf-template-editor"
    echo ""
fi