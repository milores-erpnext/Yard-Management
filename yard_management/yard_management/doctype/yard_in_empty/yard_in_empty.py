# Copyright (c) 2026, Milores and contributors
# For license information, please see license.txt

import frappe
import requests
import re
from frappe.model.document import Document
import xml.etree.ElementTree as ET
from datetime import datetime
from bs4 import BeautifulSoup
from datetime import datetime
from frappe.model.mapper import get_mapped_doc
from frappe.utils import today

class YardInEmpty(Document):
	pass

@frappe.whitelist()
def make_sales_invoice(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.customer = source.customer
        # target.company = source.company
        # target.project = source.project
        # target.due_date = frappe.utils.today()


    doc = get_mapped_doc(
        "Yard In Empty",
        source_name,
        {
            "Yard In Empty": {
                "doctype": "Sales Invoice",
                # "validation": {
                #     "docstatus": ["=", 1]
                # }
            },
            # "Contract Agreement Table": {
            #     "doctype": "Sales Invoice Item",
            #     "field_map": {
            #         "item_code": "item_code",
            #         "item_name": "item_name",
            #         "qty": "qty",
            #         "rate": "rate",
            #         "amount": "amount"
            #     }
            # }
        },
        target_doc,
        set_missing_values
    )

    return doc
