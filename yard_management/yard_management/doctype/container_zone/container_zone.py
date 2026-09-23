# Copyright (c) 2026, Milores and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ContainerZone(Document):
	def validate(self):
		self.generate_location_rows()

	def generate_location_rows(self):
		if not self.zone:
			return

		if not self.max_slot_no or not self.max_stack_level:
			self.container_zone_stack = []
			return

		self.container_zone_stack = []

		for slot_no in range(1, self.max_slot_no + 1):
			for stack_level in range(1, self.max_stack_level + 1):
				self.append("container_zone_stack", {
					"location_code": f"{self.zone}-{slot_no}-{stack_level}",
					"occupancy": 0
				})
