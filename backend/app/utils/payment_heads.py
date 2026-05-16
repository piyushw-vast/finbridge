DEFAULT_PAYMENT_HEADS = {
    "manufacturing": [
        {"name": "Raw Materials", "sub_heads": ["Steel", "Plastics", "Chemicals", "Packaging"]},
        {"name": "Labour", "sub_heads": ["Direct Labour", "Contract Labour", "Overtime"]},
        {"name": "Utilities", "sub_heads": ["Electricity", "Water", "Fuel"]},
        {"name": "Logistics", "sub_heads": ["Inbound Freight", "Outbound Freight", "Warehousing"]},
        {"name": "Overheads", "sub_heads": ["Repairs & Maintenance", "Factory Rent", "Insurance"]},
    ],
    "it": [
        {"name": "Payroll", "sub_heads": ["Salaries", "Bonuses", "Benefits"]},
        {"name": "Software & Licenses", "sub_heads": ["SaaS Subscriptions", "Development Tools", "Cloud Services"]},
        {"name": "Infrastructure", "sub_heads": ["Servers", "Networking", "Security"]},
        {"name": "Marketing", "sub_heads": ["Digital Ads", "Events", "PR"]},
        {"name": "G&A", "sub_heads": ["Office Rent", "Legal", "Accounting"]},
    ],
    "services": [
        {"name": "Payroll", "sub_heads": ["Salaries", "Consultant Fees", "Bonuses"]},
        {"name": "Operations", "sub_heads": ["Office Rent", "Utilities", "Supplies"]},
        {"name": "Travel & Expenses", "sub_heads": ["Domestic Travel", "International Travel", "Client Entertainment"]},
        {"name": "Marketing", "sub_heads": ["Advertising", "Branding", "Events"]},
        {"name": "Professional Fees", "sub_heads": ["Legal", "Audit", "Consulting"]},
    ],
    "trading": [
        {"name": "Purchases", "sub_heads": ["Domestic Purchases", "Import Purchases"]},
        {"name": "Logistics", "sub_heads": ["Freight", "Customs & Duties", "Insurance"]},
        {"name": "Sales Expenses", "sub_heads": ["Commissions", "Discounts", "Returns"]},
        {"name": "Overheads", "sub_heads": ["Office Rent", "Staff Salaries", "Utilities"]},
    ],
    "other": [
        {"name": "Operating Expenses", "sub_heads": ["Salaries", "Rent", "Utilities"]},
        {"name": "Capital Expenses", "sub_heads": ["Equipment", "Furniture", "Vehicles"]},
        {"name": "Miscellaneous", "sub_heads": ["Other"]},
    ],
}


def get_default_heads(business_type: str) -> list[dict]:
    return DEFAULT_PAYMENT_HEADS.get(business_type, DEFAULT_PAYMENT_HEADS["other"])
