#!/usr/bin/env python

from setuptools import find_packages, setup

setup(
    name="repo_visualizer",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
)
