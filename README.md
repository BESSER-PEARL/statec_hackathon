# Ageing Luxembourg Hackathon Deliverable

This repository now hosts the datasets and interactive dashboard prepared for the 2025 STATEC Hackathon (“Ageing Luxembourg”). Key highlights:

- dashboard/ contains a Vite + React app that reads STATEC’s LUSTAT SDMX API in real time (see dashboard/README.md for running and proxy instructions).
- scripts/ keeps optional SDMX helper utilities (sdmx_fetch_data.py, prepare_dashboard_data.py) in case an offline snapshot or data transformation is needed.
- data/ stores the original resources supplied by STATEC (shapefiles, PDFs, etc.); the dashboard no longer depends on pre-generated CSV/JSON exports.

The original BESSER-PEARL template documentation is kept below for reference.

# Template for BESSER-PEARL Organization Repositories

This Github template provides a collection of base files and configuration recommendations for kick-starting a new project in the BESSER-PEARL organization.

## âš’ï¸ Using this template for your project

To use this template when creating a new repository in the BESSER-PEARL GitHub organization, you have to set the `Repository template` field to `BESSER-PEARL/template`.

The new repository will use this one as a template, meaning that it will contain all the files. 
Once the new repository is created, you can edit its files to adapt them to your needs.

## â˜‘ï¸ Guidelines & Contributing

You will find a guided description of the steps you should follow in the [guidelines](guidelines.md) file.

## ðŸ““ Publishing the documentation to ReadTheDocs

This template also provides the base files to deploy the repository documentation using [ReadTheDocs](https://docs.readthedocs.io/en/stable/index.html). In the `docs` folder you can find and edit all the Sphinx documentation sources. You can check the documentation generated from this template at the [following link](https://besser-template.readthedocs.io/en/latest/). 

For more information on how to connect your repository, customize, and deploy the documentation with ReadTheDocs, you can follow [this tutorial](https://docs.readthedocs.io/en/stable/tutorial/index.html). If you do not plan to use ReadTheDocs, remove the `docs` folder and the `.readthedocs.yaml` file from your repository.

## ðŸ“š References

This project is an extended and adapted version (to the [BESSER-PEARL organization](https://github.com/organizations/BESSER-PEARL/)) of the [GitHub Best Practices Template](https://github.com/jlcanovas/gh-best-practices-template.git)
