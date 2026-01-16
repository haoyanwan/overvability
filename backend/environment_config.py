"""Environment configuration and resource group filtering logic."""

VALID_ENVIRONMENTS = ['dev', 'fra', 'release']
DEFAULT_ENVIRONMENT = 'dev'

# Resource group naming patterns per environment
# These patterns are used to filter Azure VMs by environment
ENVIRONMENT_RESOURCE_GROUP_PATTERNS = {
    'dev': ['DEV', 'DEVELOPMENT', 'NINEBOT-DEV', 'NINEBOT-WILLAND-TESTENV'],
    'fra': ['FRA', 'WILLAND', 'NINEBOT-WILLAND'],
    'release': ['RELEASE', 'PROD', 'PRODUCTION', 'NINEBOT-RELEASE'],
}


def get_environment_for_resource_group(resource_group: str) -> str:
    """Determine environment from resource group name."""
    rg_upper = resource_group.upper()
    for env, patterns in ENVIRONMENT_RESOURCE_GROUP_PATTERNS.items():
        for pattern in patterns:
            if pattern in rg_upper:
                return env
    return DEFAULT_ENVIRONMENT


def filter_services_by_environment(services: list, env: str) -> list:
    """Filter services list to only include those matching the environment."""
    if env not in VALID_ENVIRONMENTS:
        env = DEFAULT_ENVIRONMENT

    filtered = []
    for service in services:
        resource_group = service.get('resourceGroup', '')
        service_env = get_environment_for_resource_group(resource_group)
        if service_env == env:
            filtered.append(service)
    return filtered


def is_valid_environment(env: str) -> bool:
    """Check if environment is valid."""
    return env in VALID_ENVIRONMENTS
