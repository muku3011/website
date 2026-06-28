package in.hutta.smdp.controller;

import java.util.List;
import java.util.Map;

public class AutheliaConfig {
    private Map<String, AutheliaUser> users;

    public Map<String, AutheliaUser> getUsers() {
        return users;
    }

    public void setUsers(Map<String, AutheliaUser> users) {
        this.users = users;
    }

    public static class AutheliaUser {
        private String displayname;
        private String password;
        private String email;
        private List<String> groups;

        public String getDisplayname() {
            return displayname;
        }

        public void setDisplayname(String displayname) {
            this.displayname = displayname;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public List<String> getGroups() {
            return groups;
        }

        public void setGroups(List<String> groups) {
            this.groups = groups;
        }
    }
}
