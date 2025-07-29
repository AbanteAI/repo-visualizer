#!/usr/bin/env python
"""
Command-line interface for Repository Visualizer.

This module provides a command-line interface for analyzing git repositories
and generating visualization data according to the repository visualization schema.
"""

import argparse
import logging
import os
import sys
from typing import List, Optional

from .analyzer import analyze_repository


def setup_logging(verbose: bool = False) -> None:
    """
    Set up logging configuration.

    Args:
        verbose: If True, set log level to DEBUG
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    """
    Parse command-line arguments.

    Args:
        args: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Analyze a git repository and generate visualization data",
    )

    parser.add_argument(
        "repo_path",
        help="Path to the git repository to analyze (defaults to current directory)",
        nargs="?",
        default=os.getcwd(),
    )

    parser.add_argument(
        "-o",
        "--output",
        help="Output JSON file path (default: repo_data.json in current directory)",
        default="repo_data.json",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        help="Enable verbose output",
        action="store_true",
    )

    parser.add_argument(
        "--github",
        help="Enable GitHub integration to fetch PR activity data (adds github_activity metric)",
        action="store_true",
    )

    parser.add_argument(
        "--github-token",
        help="GitHub personal access token (can also be set via GITHUB_TOKEN env var)",
        type=str,
    )

    return parser.parse_args(args)


def main(args: Optional[List[str]] = None) -> int:
    """
    Main entry point for the CLI.

    Args:
        args: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Exit code (0 for success, non-zero for errors)
    """
    parsed_args = parse_args(args)
    setup_logging(parsed_args.verbose)

    logger = logging.getLogger("repo-visualizer")

    try:
        # Validate repository path
        repo_path = os.path.abspath(parsed_args.repo_path)
        if not os.path.isdir(repo_path):
            logger.error(f"Repository path does not exist: {repo_path}")
            return 1

        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            logger.error(f"Not a git repository: {repo_path}")
            return 1

        # Process output path
        output_path = parsed_args.output
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.isdir(output_dir):
            logger.error(f"Output directory does not exist: {output_dir}")
            return 1

        # Analyze repository
        logger.info(f"Analyzing repository at {repo_path}")

        # GitHub integration
        enable_github = parsed_args.github
        github_token = parsed_args.github_token

        if enable_github:
            logger.info("GitHub integration enabled - fetching PR activity data")
            if not github_token and not os.getenv("GITHUB_TOKEN"):
                logger.warning(
                    "No GitHub token provided. API requests will be rate-limited."
                )

        analyze_repository(
            repo_path,
            output_path,
            enable_github=enable_github,
            github_token=github_token,
        )

        logger.info(f"Analysis complete. Output saved to {output_path}")
        return 0

    except Exception as e:
        logger.error(f"Error analyzing repository: {e}", exc_info=parsed_args.verbose)
        return 1


if __name__ == "__main__":
    sys.exit(main())
