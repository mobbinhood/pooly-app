-- RLS Policies for Pooly App
-- Users can only access data within their organization

-- Organizations: users can view/update their own org
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Users: can view org members, admins can manage
CREATE POLICY "Users can view org members"
  ON users FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid() OR organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update org members"
  ON users FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete org members"
  ON users FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Customers: org members can CRUD
CREATE POLICY "Users can view org customers"
  ON customers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create org customers"
  ON customers FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update org customers"
  ON customers FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete org customers"
  ON customers FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Pools: access via customer's org
CREATE POLICY "Users can view pools"
  ON pools FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can create pools"
  ON pools FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can update pools"
  ON pools FOR UPDATE
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can delete pools"
  ON pools FOR DELETE
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- Routes: org members can CRUD
CREATE POLICY "Users can view org routes"
  ON routes FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create org routes"
  ON routes FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update org routes"
  ON routes FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete org routes"
  ON routes FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Route Stops: access via route's org
CREATE POLICY "Users can view route stops"
  ON route_stops FOR SELECT
  USING (route_id IN (SELECT id FROM routes WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can create route stops"
  ON route_stops FOR INSERT
  WITH CHECK (route_id IN (SELECT id FROM routes WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can update route stops"
  ON route_stops FOR UPDATE
  USING (route_id IN (SELECT id FROM routes WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can delete route stops"
  ON route_stops FOR DELETE
  USING (route_id IN (SELECT id FROM routes WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- Service Logs: access via customer's org
CREATE POLICY "Users can view service logs"
  ON service_logs FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can create service logs"
  ON service_logs FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- Discounts: org members can CRUD
CREATE POLICY "Users can view org discounts"
  ON discounts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create org discounts"
  ON discounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update org discounts"
  ON discounts FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete org discounts"
  ON discounts FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Subscriptions: access via customer's org
CREATE POLICY "Users can view subscriptions"
  ON subscriptions FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can create subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- Allow new users to create their first organization (no existing org)
CREATE POLICY "New users can create an organization"
  ON organizations FOR INSERT
  WITH CHECK (true);
