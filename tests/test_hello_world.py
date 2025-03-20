"""Tests for hello world module."""

import io
from unittest.mock import patch

from hello_world.main import hello_world, main


def test_hello_world():
    """Test hello_world returns correct string."""
    assert hello_world() == "Hello, World!"


def test_main_prints_hello_world():
    """Test main function prints hello world."""
    captured_output = io.StringIO()
    with patch("sys.stdout", new=captured_output):
        main()
    assert captured_output.getvalue().strip() == "Hello, World!"
