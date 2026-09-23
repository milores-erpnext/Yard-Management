// Copyright (c) 2026, Milores and contributors
// For license information, please see license.txt

frappe.ui.form.on('Yard In Empty', {
    zone: function (frm) {
        render_container_zone_map(frm);
    },

    refresh: function (frm) {
        // Re-render on load too, in case zone is already set (e.g. amended doc)
        if (frm.doc.zone) {
            render_container_zone_map(frm);
        }
        frm.add_custom_button(__("Sales Invoice"), () => make_sales_invoice(frm), __("Create"));
    }
});

function render_container_zone_map(frm) {
    console.log('[cz-map] render_container_zone_map fired, zone =', frm.doc.zone);

    if (!frm.doc.zone) {
        clear_zone_map(frm);
        return;
    }

    // Step 1: find the Container Zone document that matches the selected zone
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Container Zone',
            filters: { zone: frm.doc.zone },
            fields: ['name'],
            limit_page_length: 1
        },
        callback: function (r) {
            console.log('[cz-map] get_list result:', r);

            if (!r.message || !r.message.length) {
                clear_zone_map(frm, `No Container Zone found for zone "${frm.doc.zone}"`);
                frappe.msgprint(__('No Container Zone document found with zone = "{0}". Check spelling/case.', [frm.doc.zone]));
                return;
            }

            let cz_name = r.message[0].name;

            // Step 2: fetch the full Container Zone doc (includes the
            // container_zone_stack child table with all location_code rows)
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Container Zone',
                    name: cz_name
                },
                callback: function (res) {
                    console.log('[cz-map] get doc result:', res);

                    let doc = res.message;
                    if (!doc) {
                        clear_zone_map(frm, 'Could not load Container Zone document.');
                        return;
                    }
                    if (!doc.container_zone_stack || !doc.container_zone_stack.length) {
                        clear_zone_map(frm, `Container Zone "${cz_name}" has no rows in container_zone_stack.`);
                        return;
                    }

                    build_zone_grid(
                        frm,
                        doc.container_zone_stack,
                        cint(doc.max_slot_no),
                        cint(doc.max_stack_level)
                    );
                },
                error: function (err) {
                    console.error('[cz-map] error fetching Container Zone doc:', err);
                    frappe.msgprint(__('Error fetching Container Zone. You may lack Read permission on this doctype.'));
                }
            });
        },
        error: function (err) {
            console.error('[cz-map] error fetching Container Zone list:', err);
            frappe.msgprint(__('Error searching Container Zone. You may lack Read permission on this doctype.'));
        }
    });
}

function build_zone_grid(frm, stack_rows, max_slot_no, max_stack_level) {
    if (!max_slot_no || !max_stack_level) {
        clear_zone_map(frm, 'Container Zone is missing max_slot_no / max_stack_level');
        return;
    }

    // Build lookup: slot -> stack -> { location_code, occupancy }
    let map = {};
    stack_rows.forEach(function (row) {
        // location_code format: ZONE-SLOT-STACK  e.g. "AA-1-1"
        let parts = (row.location_code || '').split('-');
        if (parts.length < 3) return;

        let slot = parseInt(parts[1], 10);
        let stack = parseInt(parts[2], 10);
        if (isNaN(slot) || isNaN(stack)) return;

        map[slot] = map[slot] || {};
        map[slot][stack] = row;
    });

    // Build HTML grid.
    // Rows    -> stack level, from max_stack_level down to 1 (top = highest stack)
    // Columns -> slot number, from max_slot_no down to 1 (left = highest slot)
    let html = `
        <div class="cz-map-wrapper">
            <div class="cz-legend">
                <span class="cz-swatch cz-vacant"></span> Vacant
                <span class="cz-swatch cz-occupied"></span> Occupied
                <span class="cz-swatch cz-empty"></span> No Slot
            </div>
            <div class="cz-grid">
    `;

    for (let stack = max_stack_level; stack >= 1; stack--) {
        html += `<div class="cz-row">`;
        for (let slot = max_slot_no; slot >= 1; slot--) {
            let cell = (map[slot] && map[slot][stack]) ? map[slot][stack] : null;
            let code = cell ? cell.location_code : '';
            let occupied = cell ? cint(cell.occupancy) : 0;

            let css_class = !cell ? 'cz-empty' : (occupied ? 'cz-occupied' : 'cz-vacant');

            html += `
                <div class="cz-cell ${css_class}" data-code="${code}">
                    ${code || '&nbsp;'}
                </div>
            `;
        }
        html += `</div>`;
    }

    html += `
            </div>
        </div>
        <style>
            .cz-map-wrapper { font-family: inherit; }
            .cz-legend { margin-bottom: 8px; font-size: 12px; }
            .cz-swatch {
                display: inline-block; width: 12px; height: 12px;
                margin: 0 4px 0 12px; border: 1px solid #999; vertical-align: middle;
            }
            .cz-swatch.cz-vacant { background: #c9f7c9; }
            .cz-swatch.cz-occupied { background: #f7c9c9; }
            .cz-swatch.cz-empty { background: #f0f0f0; }
            .cz-grid { display: inline-block; }
            .cz-row { display: flex; }
            .cz-cell {
                width: 70px; height: 48px;
                margin: 2px;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid #999; border-radius: 4px;
                font-size: 12px; font-weight: 500;
                cursor: pointer; user-select: none;
                transition: transform 0.1s ease;
            }
            .cz-cell:hover { transform: scale(1.04); }
            .cz-cell.cz-vacant   { background: #c9f7c9; }
            .cz-cell.cz-occupied { background: #f7c9c9; cursor: not-allowed; }
            .cz-cell.cz-empty    { background: #f0f0f0; color: #aaa; cursor: default; }
        </style>
    `;

    frm.set_df_property('container_zone_map', 'options', html);
    frm.refresh_field('container_zone_map');

    // Step 3: click-to-select a vacant slot -> populate the "stack" field
    frm.fields_dict['container_zone_map'].$wrapper
        .find('.cz-cell.cz-vacant')
        .off('click')
        .on('click', function () {
            let code = $(this).attr('data-code');
            if (!code) return;

            frm.set_value('stack', code);
            frm.fields_dict['container_zone_map'].$wrapper
                .find('.cz-cell').removeClass('cz-selected');
            $(this).addClass('cz-selected');
        });
}

function clear_zone_map(frm, message) {
    let html = message
        ? `<div class="text-muted" style="padding:8px;">${message}</div>`
        : '';
    frm.set_df_property('container_zone_map', 'options', html);
    frm.refresh_field('container_zone_map');
}

function make_sales_invoice(frm) {
    frappe.model.open_mapped_doc({
        method: "yard_management.yard_management.doctype.yard_in_empty.yard_in_empty.make_sales_invoice",
        frm: frm
    });
}
