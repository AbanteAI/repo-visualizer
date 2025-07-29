"""
GitHub API client for fetching repository data.

This module provides functionality to fetch data from GitHub's API,
specifically for getting information about open pull requests and
their file changes to create activity heat maps.
"""

import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class GitHubClient:
    """Client for interacting with GitHub's API."""

    def __init__(self, token: Optional[str] = None):
        """
        Initialize the GitHub client.

        Args:
            token: GitHub personal access token. If not provided, will try to get from
                   GITHUB_TOKEN environment variable.
        """
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.base_url = "https://api.github.com"
        self.session = requests.Session()

        if self.token:
            self.session.headers.update(
                {
                    "Authorization": f"token {self.token}",
                    "Accept": "application/vnd.github.v3+json",
                }
            )
        else:
            logger.warning(
                "No GitHub token provided. API requests will be rate-limited."
            )

    def _make_request(
        self, endpoint: str, params: Optional[Dict] = None
    ) -> Optional[Dict]:
        """
        Make a request to the GitHub API.

        Args:
            endpoint: API endpoint (without base URL)
            params: Query parameters

        Returns:
            JSON response data or None if request failed
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        try:
            response = self.session.get(url, params=params or {})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"GitHub API request failed: {e}")
            return None

    def _paginate_request(
        self, endpoint: str, params: Optional[Dict] = None, max_pages: int = 10
    ) -> List[Dict]:
        """
        Make paginated requests to the GitHub API.

        Args:
            endpoint: API endpoint
            params: Query parameters
            max_pages: Maximum number of pages to fetch

        Returns:
            List of all items from all pages
        """
        all_items = []
        page = 1
        params = params or {}

        while page <= max_pages:
            params["page"] = page
            params["per_page"] = 100  # Maximum items per page

            data = self._make_request(endpoint, params)
            if not data or not isinstance(data, list):
                break

            all_items.extend(data)

            # If we got less than per_page items, we've reached the end
            if len(data) < params["per_page"]:
                break

            page += 1

        return all_items

    def extract_repo_info_from_git_url(
        self, repo_path: str
    ) -> Optional[Tuple[str, str]]:
        """
        Extract GitHub owner and repo name from git remote URL.

        Args:
            repo_path: Path to the local git repository

        Returns:
            Tuple of (owner, repo) or None if not a GitHub repository
        """
        try:
            import subprocess

            # Get the remote origin URL
            result = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode != 0:
                return None

            remote_url = result.stdout.strip()

            # Parse GitHub URLs (both HTTPS and SSH)
            # HTTPS: https://github.com/owner/repo.git
            # HTTPS with credentials: https://user:token@github.com/owner/repo.git
            # SSH: git@github.com:owner/repo.git

            github_patterns = [
                r"https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
                r"https://[^@]+@github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
                r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?/?$",
            ]

            for pattern in github_patterns:
                match = re.match(pattern, remote_url)
                if match:
                    owner, repo = match.groups()
                    return owner, repo

            return None

        except Exception as e:
            logger.error(f"Failed to extract GitHub repo info: {e}")
            return None

    def get_open_pull_requests(self, owner: str, repo: str) -> List[Dict]:
        """
        Get all open pull requests for a repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            List of pull request data
        """
        endpoint = f"repos/{owner}/{repo}/pulls"
        params = {"state": "open"}

        prs = self._paginate_request(endpoint, params)
        logger.info(f"Found {len(prs)} open pull requests")

        return prs

    def get_pull_request_files(
        self, owner: str, repo: str, pr_number: int
    ) -> List[Dict]:
        """
        Get the files changed in a specific pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number

        Returns:
            List of file change data
        """
        endpoint = f"repos/{owner}/{repo}/pulls/{pr_number}/files"

        files = self._paginate_request(endpoint)
        logger.debug(f"PR #{pr_number} has {len(files)} changed files")

        return files

    def analyze_repository_activity(self, repo_path: str) -> Optional[Dict[str, Dict]]:
        """
        Analyze GitHub activity for a repository.

        Args:
            repo_path: Path to the local git repository

        Returns:
            Dictionary mapping file paths to activity metrics, or None if failed
        """
        # Extract repository information
        repo_info = self.extract_repo_info_from_git_url(repo_path)
        if not repo_info:
            logger.warning("Could not determine GitHub repository from git remote")
            return None

        owner, repo = repo_info
        logger.info(f"Analyzing GitHub activity for {owner}/{repo}")

        # Get open pull requests
        prs = self.get_open_pull_requests(owner, repo)
        if not prs:
            logger.info("No open pull requests found")
            return {}

        # Analyze file changes across all open PRs
        file_activity = {}

        for pr in prs:
            pr_number = pr["number"]
            pr_created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            pr_updated = datetime.fromisoformat(pr["updated_at"].replace("Z", "+00:00"))

            # Get files changed in this PR
            files = self.get_pull_request_files(owner, repo, pr_number)

            for file_data in files:
                filename = file_data["filename"]

                if filename not in file_activity:
                    file_activity[filename] = {
                        "pr_count": 0,
                        "total_additions": 0,
                        "total_deletions": 0,
                        "total_changes": 0,
                        "latest_pr_date": None,
                        "earliest_pr_date": None,
                        "pr_numbers": [],
                        "change_frequency": 0.0,
                        "activity_score": 0.0,
                    }

                activity = file_activity[filename]
                activity["pr_count"] += 1
                activity["total_additions"] += file_data.get("additions", 0)
                activity["total_deletions"] += file_data.get("deletions", 0)
                activity["total_changes"] += file_data.get("changes", 0)
                activity["pr_numbers"].append(pr_number)

                # Track date ranges
                if (
                    activity["latest_pr_date"] is None
                    or pr_updated > activity["latest_pr_date"]
                ):
                    activity["latest_pr_date"] = pr_updated
                if (
                    activity["earliest_pr_date"] is None
                    or pr_created < activity["earliest_pr_date"]
                ):
                    activity["earliest_pr_date"] = pr_created

        # Calculate derived metrics
        tzinfo = None
        if file_activity:
            first_activity = next(iter(file_activity.values()))
            first_dt = first_activity.get("latest_pr_date")
            tzinfo = first_dt.tzinfo if isinstance(first_dt, datetime) else None
        now = datetime.now(tz=tzinfo)
        max_changes = max(
            (activity["total_changes"] for activity in file_activity.values()),
            default=1,
        )
        max_pr_count = max(
            (activity["pr_count"] for activity in file_activity.values()), default=1
        )

        for filename, activity in file_activity.items():
            # Change frequency: how often this file is being modified
            activity["change_frequency"] = activity["pr_count"] / max_pr_count

            # Activity score: combination of change volume and recency
            change_intensity = activity["total_changes"] / max_changes

            # Recency factor (more recent = higher score)
            if activity["latest_pr_date"]:
                days_since_update = (now - activity["latest_pr_date"]).days
                recency_factor = max(
                    0, 1 - (days_since_update / 30)
                )  # Decay over 30 days
            else:
                recency_factor = 0

            activity["activity_score"] = (change_intensity * 0.7) + (
                recency_factor * 0.3
            )

        logger.info(
            f"Analyzed activity for {len(file_activity)} files across {len(prs)} open PRs"
        )
        return file_activity


def create_github_client(token: Optional[str] = None) -> GitHubClient:
    """
    Create a GitHub client instance.

    Args:
        token: GitHub personal access token

    Returns:
        GitHubClient instance
    """
    return GitHubClient(token)
